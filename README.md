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

## Getting started (local, minimal)
1. Python 3.11+
2. Create and activate virtualenv
3. Install deps: `pip install -r requirements.txt`
4. Run API locally: `uvicorn app.main:app --reload`
5. Visit http://localhost:8000/health

Docker, Celery worker, Redis, and PostgreSQL compose setup will be added in later steps.

## Using Upstash Redis
- Upstash provides Redis over TLS. Use a `rediss://` URL.
- Example:
  - `REDIS_URL=rediss://default:<password>@<host>:<port>`
  - `BROKER_URL=${REDIS_URL}`
  - `RESULT_BACKEND=${REDIS_URL}`
- Put these in your environment or copy and edit `env.example`.

## Roadmap
- Scaffold repo (this commit)
- Database models + migrations
- CRUD APIs
- CSV import + progress
- Frontend
- Webhooks
- Containerization and deployment
