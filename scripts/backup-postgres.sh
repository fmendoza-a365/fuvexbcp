#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
CONTAINER="${POSTGRES_CONTAINER:-fuvex_postgres_prod}"
DB="${POSTGRES_DB:-fuvex}"
USER="${POSTGRES_USER:-fuvex}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
TMP_FILE="$BACKUP_DIR/fuvex_${TIMESTAMP}.sql"
BACKUP_FILE="$TMP_FILE.gz"

mkdir -p "$BACKUP_DIR"

if ! $DOCKER_BIN exec "$CONTAINER" pg_dump -U "$USER" "$DB" > "$TMP_FILE"; then
  rm -f "$TMP_FILE" "$BACKUP_FILE"
  echo "Error: no se pudo crear el dump de PostgreSQL desde el contenedor $CONTAINER" >&2
  exit 1
fi

gzip -f "$TMP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  rm -f "$BACKUP_FILE"
  echo "Error: el backup generado esta vacio" >&2
  exit 1
fi

echo "Backup creado: $BACKUP_FILE"
