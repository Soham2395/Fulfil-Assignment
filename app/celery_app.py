from __future__ import annotations

import ssl
from celery import Celery
from .config import settings

celery_app = Celery(
    "acme_importer",
    broker=settings.broker_url,
    backend=settings.result_backend,
    include=["app.tasks"],
)

celery_app.conf.broker_use_ssl = {
    "ssl_cert_reqs": ssl.CERT_NONE
}

celery_app.conf.redis_backend_use_ssl = {
    "ssl_cert_reqs": ssl.CERT_NONE
}

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_concurrency=2,
    task_acks_late=True,
    broker_heartbeat=30,
    broker_pool_limit=10,
)

try:
    from . import tasks as _tasks
except Exception:
    pass


@celery_app.task(name="ping")
def ping() -> str:
    return "pong"
