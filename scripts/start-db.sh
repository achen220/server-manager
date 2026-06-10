#!/bin/bash
set -e

# Load variables from .env
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
fi

CONTAINER_NAME="server-manager"

# Parse credentials from DATABASE_URL: postgresql://user:password@host:port/db
PG_USER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
PG_PASSWORD=$(python3 -c "import urllib.parse, sys; print(urllib.parse.unquote(sys.argv[1]))" "$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')")
PG_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
PG_DB=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

# 1. Start Colima if not already running
if ! colima status 2>/dev/null | grep -q "Running"; then
  echo "Starting Colima..."
  colima start
else
  echo "Colima already running."
fi

# 2. Run the Postgres container if not already running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Postgres container '${CONTAINER_NAME}' already running."
elif docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Restarting existing container '${CONTAINER_NAME}'..."
  docker start "${CONTAINER_NAME}"
else
  echo "Starting new Postgres container '${CONTAINER_NAME}'..."
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -e POSTGRES_USER="${PG_USER}" \
    -e POSTGRES_PASSWORD="${PG_PASSWORD}" \
    -e POSTGRES_DB="${PG_DB}" \
    -p "${PG_PORT}":5432 \
    -v server-manager-pgdata:/var/lib/postgresql/data \
    postgres:17
fi

echo "Postgres is available at localhost:${PG_PORT}"
