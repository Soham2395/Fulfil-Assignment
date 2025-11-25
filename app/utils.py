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
