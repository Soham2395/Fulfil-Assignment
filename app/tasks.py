from __future__ import annotations

import csv
import logging
import os
import time
from datetime import datetime
from typing import List, Dict, Any

import httpx
from sqlalchemy import text

logger = logging.getLogger(__name__)

from .celery_app import celery_app
from .db import engine, get_session
from .models import Webhook
from .utils import init_progress, update_progress, push_error, get_redis_client, is_rate_limited


BATCH_SIZE = 5000


@celery_app.task(name="import_csv")
def import_csv(file_path: str) -> Dict[str, Any]:
    task_id = import_csv.request.id  # type: ignore[attr-defined]
    logger.info(f"Starting CSV import task {task_id} for file {file_path}")
    # Single-pass import: no total upfront, update progress incrementally
    init_progress(task_id, total=0)
    update_progress(task_id, status="running", stage="importing", message="Importing in batches")

    insert_sql = text(
        """
        INSERT INTO products (sku, name, description, price, active, created_at, updated_at)
        VALUES (:sku, :name, :description, :price, true, now(), now())
        ON CONFLICT ON CONSTRAINT uq_products_sku_ci
        DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            updated_at = now()
        """
    )

    processed = 0
    errors = 0

    try:
        with open(file_path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            batch: List[Dict[str, Any]] = []
            data_row_number = 0
            for row in reader:
                data_row_number += 1
                try:
                    sku = (row.get("sku") or "").strip()
                    name = (row.get("name") or "").strip()
                    description = row.get("description")
                    price_str = (row.get("price") or "").strip()
                    price = float(price_str) if price_str else None

                    if not sku or not name:
                        raise ValueError("Missing sku or name")

                    batch.append({
                        "sku": sku,
                        "name": name,
                        "description": description,
                        "price": price,
                    })
                except Exception as e:
                    errors += 1
                    # store a bounded set of error details in Redis
                    push_error(task_id, {
                        "row": data_row_number,
                        "error": str(e),
                        "data": {k: row.get(k) for k in ("sku", "name", "description", "price")},
                    })
                
                if len(batch) >= BATCH_SIZE:
                    _execute_batch(insert_sql, batch)
                    processed += len(batch)
                    batch.clear()
                    update_progress(task_id, processed=processed, errors=errors)

            if batch:
                _execute_batch(insert_sql, batch)
                processed += len(batch)
                update_progress(task_id, processed=processed, errors=errors)

        # Set final total = processed for UI progress bar completion
        update_progress(task_id, status="completed", stage="completed", total=processed, message="Import complete")
        logger.info(f"CSV import {task_id} completed: {processed} processed, {errors} errors")
        return {"status": "completed", "processed": processed, "errors": errors}
    except Exception as e:
        logger.error(f"CSV import {task_id} failed: {e}", exc_info=True)
        update_progress(task_id, status="failed", stage="importing", message=str(e))
        return {"status": "failed", "reason": str(e)}
    finally:
        try:
            os.remove(file_path)
        except Exception:
            pass


def _execute_batch(insert_sql, batch: List[Dict[str, Any]]):
    # Use a single transaction per batch for speed
    with engine.begin() as conn:
        conn.execute(insert_sql, batch)


@celery_app.task(name="send_webhook", bind=True, max_retries=5)
def send_webhook(self, webhook_id: int, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    logger.debug(f"Sending webhook {webhook_id} for event {event_type}")
    # Fetch webhook, send request, and record last response stats
    with get_session() as db:
        wh = db.get(Webhook, webhook_id)
        if not wh:
            return {"status": "not_found"}
        if not wh.enabled or wh.event_type != event_type:
            return {"status": "skipped"}

        # Rate limiting: fixed window per webhook (e.g., 60 requests per 60s)
        RATE_LIMIT = 60
        WINDOW = 60
        rl_key = f"webhook:{wh.id}:window:{WINDOW}"
        limited = is_rate_limited(rl_key, RATE_LIMIT, WINDOW)
        if limited:
            # Try again after window TTL
            ttl = get_redis_client().ttl(rl_key)
            delay = int(ttl) if ttl and ttl > 0 else 5
            raise self.retry(countdown=delay)

        start = time.perf_counter()
        code = 0
        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.post(wh.url, json=payload, headers={"Content-Type": "application/json"})
                code = resp.status_code
                # Retry on 5xx server errors
                if 500 <= code < 600:
                    raise self.retry(countdown=2 ** self.request.retries, max_retries=3)
        except httpx.RequestError as e:
            # Retry on network errors (connection, timeout, etc.)
            raise self.retry(exc=e, countdown=2 ** self.request.retries, max_retries=3)
        except Exception:
            # Other errors: record but don't retry
            code = 0
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        # Update response metadata
        wh.last_response_code = code
        wh.last_response_time_ms = elapsed_ms
        db.flush()
        
        if code == 0:
            logger.warning(f"Webhook {webhook_id} failed with code {code}")
        else:
            logger.info(f"Webhook {webhook_id} sent: {code} in {elapsed_ms}ms")

        return {"status": "sent", "status_code": code, "elapsed_ms": elapsed_ms}
