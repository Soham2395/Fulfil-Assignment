# Backend Dockerfile
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install minimal OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy application code
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY app ./app

# Runtime env (override via compose/env)
ENV ENVIRONMENT=production \
    HOST=0.0.0.0 \
    PORT=8000

# Entrypoint script to run migrations and start service
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

# SERVICE can be: api | worker
ENV SERVICE=api

ENTRYPOINT ["/entrypoint.sh"]
