from __future__ import annotations

import asyncio
import json
import os
import tempfile
from typing import AsyncGenerator, Dict, Any

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from app.celery_app import celery_app
from app.utils import get_progress, get_errors, get_errors_count

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)) -> JSONResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    # Save to a temporary file
    suffix = os.path.splitext(file.filename)[1]
    fd, temp_path = tempfile.mkstemp(prefix="upload_", suffix=suffix)
    os.close(fd)

    try:
        with open(temp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                out.write(chunk)
    finally:
        await file.close()

    # Enqueue Celery task
    task = celery_app.send_task("import_csv", args=[temp_path])

    return JSONResponse({"task_id": task.id})


@router.get("/progress/{task_id}")
async def progress(task_id: str) -> JSONResponse:
    data = get_progress(task_id) or {"status": "unknown", "message": "No progress yet"}
    return JSONResponse(data)


@router.get("/progress/{task_id}/stream")
async def progress_stream(task_id: str) -> EventSourceResponse:
    async def event_generator() -> AsyncGenerator[Dict[str, Any], None]:
        last_sent = None
        while True:
            data = get_progress(task_id)
            if data and data != last_sent:
                yield {
                    "event": "progress",
                    "data": json.dumps(data),
                }
                last_sent = data
                if data.get("status") in {"completed", "failed"}:
                    break
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@router.get("/errors/{task_id}")
async def import_errors(task_id: str, limit: int = 100) -> JSONResponse:
    """Return up to `limit` recent CSV row errors and the total error count for the task."""
    errs = get_errors(task_id, limit=limit)
    count = get_errors_count(task_id)
    return JSONResponse({"count": count, "items": errs})
