# Acme Products Importer

A scalable web application to import up to ~500k products from CSV into PostgreSQL, manage products via UI, track upload progress in real-time, and configure webhooks.

Tech stack:
- FastAPI (web framework)
- Celery + Redis (async background tasks and progress tracking)
- SQLAlchemy (ORM)
- PostgreSQL (database)
- Simple HTML/JS frontend (vanilla)

## High-level architecture
- FastAPI serves APIs and frontend.
- CSV uploads enqueue a Celery task.
- Task streams progress via Redis; UI subscribes via SSE endpoint.
- Products CRUD with filters and pagination.
- Webhooks persisted and dispatched async on product events.

## Getting started (local)

There are two ways to run locally:

1) Without Docker (simple local dev)
- Python 3.11+
- Create and activate a virtualenv
- Install deps: `pip install -r requirements.txt`
- Create a `.env` in the repo root (see "Environment variables" below)
- Run DB migrations: `alembic upgrade head`
- Start API: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Start Celery worker: `celery -A app.celery_app.celery_app worker --loglevel=info --concurrency=2`
- Visit http://localhost:8000/health

2) With Docker Compose (Postgres + Redis + API + Worker)
- Ensure Docker Desktop is running
- Copy `.env` variables you need; Compose also sets sane defaults for local containers
- Start: `docker compose up --build`
- API: http://localhost:8000
- Logs: `docker compose logs -f api` and `docker compose logs -f worker`

## Environment variables

The app reads configuration from environment variables via `app/config.py` (Pydantic Settings). A `.env` file in the repo root is automatically loaded in local development.

Minimum set for local development:

```
# Postgres (SQLAlchemy URL uses driver prefix)
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME

# Redis / Celery
# REDIS_URL=redis://localhost:6379/0
# BROKER_URL=redis://localhost:6379/1
# RESULT_BACKEND=redis://localhost:6379/2

# CORS (optional)
CORS_ORIGINS=*
```

## Roadmap
- Scaffold repo (this commit)
- Database models + migrations
- CRUD APIs
- CSV import + progress
- Frontend
- Webhooks
- Containerization and deployment

## Running the services

### Without Docker
- API: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Worker: `celery -A app.celery_app.celery_app worker --loglevel=info --concurrency=2`

### With Docker Compose
- Start everything: `docker compose up --build`
- Stop: `docker compose down`

### Service discovery and ports
- API exposed on port 8000 by default (see `Dockerfile` and `docker-compose.yml`).
- Redis and Postgres ports are mapped for local access when using Compose.

## Migrations (Alembic)
1. Ensure `DATABASE_URL` is set. Use the SQLAlchemy driver prefix: `postgresql+psycopg2://...`
   - Cloud DBs that require TLS may append `?sslmode=require`.
2. Install dependencies: `pip install -r requirements.txt`
3. Apply migrations: `alembic upgrade head`
4. Generate migrations after model changes:
   - `alembic revision --autogenerate -m "<message>"`
   - `alembic upgrade head`
5. Note: When running via Docker, the `docker/entrypoint.sh` runs `alembic upgrade head` on container start to keep the schema up to date.

## Docker Compose quickstart

`docker-compose.yml` provisions:
- `db` (Postgres)
- `redis`
- `api` (FastAPI)
- `worker` (Celery)

Useful commands:
- Build and start: `docker compose up --build`
- Tail logs for API: `docker compose logs -f api`
- Tail logs for Worker: `docker compose logs -f worker`
- Stop and remove: `docker compose down`

## Performance and Scalability

### Database Connection Pooling
The app uses SQLAlchemy connection pooling with:
- `pool_size=10` (default connections)
- `max_overflow=20` (additional connections under load)

**Recommendations**:
- For **web service**: Default settings are fine for moderate traffic (10-30 concurrent requests)
- For **Celery workers**: 
  - If running N workers with concurrency C each, ensure: `pool_size + max_overflow >= N * C`
  - Example: 2 workers × 2 concurrency = 4 connections needed minimum
  - Recommended: Set `worker_concurrency=2` in `celery_app.py` for free-tier databases
- For **high concurrency**: Increase `pool_size` or use PgBouncer connection pooler

### CSV Import Performance
- **Single-pass import**: Processes 500k rows in ~half the time vs double-pass
- **Batch size**: 5000 rows per transaction (tunable via `BATCH_SIZE` in `tasks.py`)
- **Expected throughput**: ~10k-20k rows/sec on typical cloud databases
- **Memory usage**: Bounded by batch size (~1-2MB per batch)

### Webhook Rate Limiting
- Default: 60 requests per 60 seconds per webhook
- Uses Redis-backed fixed-window rate limiter with atomic Lua script
- Automatically retries rate-limited requests after window expires
- Adjust `RATE_LIMIT` and `WINDOW` in `app/tasks.py` as needed
