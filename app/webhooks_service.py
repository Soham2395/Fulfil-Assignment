from __future__ import annotations

import time
from typing import Any, Dict, List

import httpx
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .models import Webhook
from .celery_app import celery_app


async def _post_json(url: str, payload: Dict[str, Any], timeout: float = 8.0) -> int:
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        return resp.status_code


def get_enabled_webhooks(db: Session, event_type: str) -> List[Webhook]:
    rows = db.execute(
        select(Webhook).where(Webhook.enabled.is_(True), Webhook.event_type == event_type)
    ).scalars().all()
    return rows


async def send_and_record(db: Session, webhook: Webhook, payload: Dict[str, Any]) -> Dict[str, Any]:
    start = time.perf_counter()
    code = 0
    try:
        code = await _post_json(webhook.url, payload)
    except Exception:
        code = 0
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    # update last response info
    db.execute(
        update(Webhook)
        .where(Webhook.id == webhook.id)
        .values(last_response_code=code, last_response_time_ms=elapsed_ms)
    )
    return {"status_code": code, "elapsed_ms": elapsed_ms}


def enqueue_event(event_type: str, payload: Dict[str, Any]) -> List[str]:
    """Enqueue webhook deliveries for all enabled webhooks for the event.
    Creates its own DB session to avoid session reuse issues.
    Returns a list of Celery task IDs.
    """
    from .db import get_session
    
    with get_session() as db:
        webhooks = get_enabled_webhooks(db, event_type)
        task_ids: List[str] = []
        for wh in webhooks:
            task = celery_app.send_task("send_webhook", args=[wh.id, event_type, payload])
            task_ids.append(task.id)
        return task_ids
