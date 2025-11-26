#!/usr/bin/env sh
set -euo pipefail

# Wait for Postgres and Redis if host/port provided
wait_for() {
  HOST="$1"; PORT="$2"; NAME="$3"; TIMEOUT="${4:-30}"
  echo "Waiting for $NAME at ${HOST}:${PORT} (timeout ${TIMEOUT}s)..."
  for i in $(seq 1 "$TIMEOUT"); do
    if nc -z "$HOST" "$PORT" >/dev/null 2>&1; then
      echo "$NAME is up"
      return 0
    fi
    sleep 1
  done
  echo "Timeout waiting for $NAME" >&2
  return 1
}

# Optional waits based on env
if [ -n "${DATABASE_HOST:-}" ] && [ -n "${DATABASE_PORT:-}" ]; then
  wait_for "$DATABASE_HOST" "$DATABASE_PORT" "Postgres" "60"
fi
if [ -n "${REDIS_HOST:-}" ] && [ -n "${REDIS_PORT:-}" ]; then
  wait_for "$REDIS_HOST" "$REDIS_PORT" "Redis" "60"
fi

# Run migrations (safe to run on every start)
if [ -f "/app/alembic.ini" ]; then
  echo "Running migrations..."
  alembic upgrade head || { echo "Migrations failed" >&2; exit 1; }
fi

echo "Starting service: ${SERVICE} (HOST=${HOST:-}, PORT=${PORT:-}, UVICORN_WORKERS=${UVICORN_WORKERS:-})"
case "${SERVICE}" in
  api)
    # Always bind to 0.0.0.0 inside container to ensure host reachability
    exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${UVICORN_WORKERS:-2}"
    ;;
  worker)
    # Celery worker
    exec celery -A app.celery_app.celery_app worker --loglevel="${CELERY_LOGLEVEL:-info}" --concurrency="${CELERY_CONCURRENCY:-2}"
    ;;
  *)
    echo "Unknown SERVICE='${SERVICE}'. Use 'api' or 'worker'" >&2
    exit 1
    ;;
 esac
