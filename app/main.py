from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routers.products import router as products_router
from .routers.uploads import router as uploads_router

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
    return JSONResponse({"status": "ok", "env": settings.environment})


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.app_name}"}


# Routers
app.include_router(products_router)
app.include_router(uploads_router)
