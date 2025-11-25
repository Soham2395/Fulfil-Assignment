from __future__ import annotations

import json
import time
from typing import Any, Dict, Optional

import redis

from .config import settings


def get_redis_client() -> redis.Redis:
    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


def progress_key(task_id: str) -> str:
    return f"task:{task_id}:progress"


def set_progress(task_id: str, data: Dict[str, Any]) -> None:
    r = get_redis_client()
    r.set(progress_key(task_id), json.dumps(data), ex=60 * 60)


def get_progress(task_id: str) -> Optional[Dict[str, Any]]:
    r = get_redis_client()
    raw = r.get(progress_key(task_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def init_progress(task_id: str, total: int = 0) -> None:
    data = {"status": "queued", "stage": "queued", "processed": 0, "total": total, "errors": 0, "message": ""}
    set_progress(task_id, data)


def update_progress(task_id: str, **kwargs: Any) -> None:
    current = get_progress(task_id) or {}
    current.update(kwargs)
    set_progress(task_id, current)


# --- CSV import error recording ---

def errors_key(task_id: str) -> str:
    return f"task:{task_id}:errors"


def push_error(task_id: str, error: Dict[str, Any], max_errors: int = 1000) -> None:
    """Push a single error to a bounded Redis list and keep a TTL."""
    r = get_redis_client()
    r.lpush(errors_key(task_id), json.dumps(error))
    r.ltrim(errors_key(task_id), 0, max_errors - 1)
    r.expire(errors_key(task_id), 60 * 60)


def get_errors(task_id: str, limit: int = 100) -> list[Dict[str, Any]]:
    r = get_redis_client()
    items = r.lrange(errors_key(task_id), 0, max(0, limit - 1))
    out = []
    for raw in items:
        try:
            out.append(json.loads(raw))
        except Exception:
            continue
    return out


def get_errors_count(task_id: str) -> int:
    r = get_redis_client()
    return int(r.llen(errors_key(task_id)) or 0)


# --- Simple fixed-window rate limiter (per key) ---

def is_rate_limited(key: str, limit: int, window_seconds: int) -> bool:
    """Return True if the given key has exceeded the limit within the window.
    Uses INCR with window TTL (fixed window). Suitable for simple webhook limiting.
    """
    r = get_redis_client()
    count = r.incr(key)
    if count == 1:
        r.expire(key, window_seconds)
    return count > limit
