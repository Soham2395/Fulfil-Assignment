from __future__ import annotations

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Webhook
from app.schemas import WebhookCreate, WebhookUpdate, WebhookOut
from app.celery_app import celery_app

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/", response_model=List[WebhookOut])
def list_webhooks(db: Session = Depends(get_db)):
    rows = db.execute(select(Webhook).order_by(Webhook.id.desc())).scalars().all()
    return rows


@router.post("/", response_model=WebhookOut, status_code=201)
def create_webhook(payload: WebhookCreate, db: Session = Depends(get_db)):
    wh = Webhook(url=payload.url, event_type=payload.event_type, enabled=payload.enabled)
    db.add(wh)
    db.flush()
    db.refresh(wh)
    return wh


@router.put("/{webhook_id}", response_model=WebhookOut)
def update_webhook(webhook_id: int, payload: WebhookUpdate, db: Session = Depends(get_db)):
    wh = db.get(Webhook, webhook_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if payload.url is not None:
        wh.url = payload.url
    if payload.event_type is not None:
        wh.event_type = payload.event_type
    if payload.enabled is not None:
        wh.enabled = payload.enabled

    db.flush()
    db.refresh(wh)
    return wh


@router.delete("/{webhook_id}", status_code=204)
def delete_webhook(webhook_id: int, db: Session = Depends(get_db)):
    wh = db.get(Webhook, webhook_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(wh)
    return None


@router.post("/{webhook_id}/test", response_model=dict)
def test_webhook(webhook_id: int, db: Session = Depends(get_db)):
    wh = db.get(Webhook, webhook_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    payload = {"event": wh.event_type, "test": True, "timestamp": "now"}
    task = celery_app.send_task("send_webhook", args=[webhook_id, wh.event_type, payload])
    return {"task_id": task.id}
