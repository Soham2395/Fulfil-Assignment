from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .db import engine
from .utils import get_redis_client
from .routers.products import router as products_router
from .routers.uploads import router as uploads_router
from .routers.webhooks import router as webhooks_router

app = FastAPI(title=settings.app_name)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Health check with dependency status (DB, Redis)."""
    checks = {"env": settings.environment}
    
    # Check database
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"
    
    # Check Redis
    try:
        get_redis_client().ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)[:100]}"
    
    # Overall status
    all_ok = checks.get("database") == "ok" and checks.get("redis") == "ok"
    checks["status"] = "healthy" if all_ok else "degraded"
    
    status_code = 200 if all_ok else 503
    return JSONResponse(checks, status_code=status_code)


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name}"}


# Routers
app.include_router(products_router)
app.include_router(uploads_router)
app.include_router(webhooks_router)
