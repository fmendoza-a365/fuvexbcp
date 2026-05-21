#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Uso: npm run db:pg:restore -- backups/postgres/fuvex_YYYYMMDD_HHMMSS.sql.gz"
  echo "Para restaurar sobre una base existente, confirma el reseteo:"
  echo "RESET_DATABASE=confirm npm run db:pg:restore -- backups/postgres/fuvex_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER="${POSTGRES_CONTAINER:-fuvex_postgres_prod}"
DB="${POSTGRES_DB:-fuvex}"
USER="${POSTGRES_USER:-fuvex}"
DOCKER_BIN="${DOCKER_BIN:-docker}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "No existe el backup: $BACKUP_FILE"
  exit 1
fi

if [ "${RESET_DATABASE:-}" = "confirm" ]; then
  echo "Reseteando schema public en $DB..."
  $DOCKER_BIN exec "$CONTAINER" psql -U "$USER" "$DB" -v ON_ERROR_STOP=1 \
    -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
fi

case "$BACKUP_FILE" in
  *.gz)
    gzip -dc "$BACKUP_FILE" | $DOCKER_BIN exec -i "$CONTAINER" psql -U "$USER" "$DB" -v ON_ERROR_STOP=1
    ;;
  *)
    $DOCKER_BIN exec -i "$CONTAINER" psql -U "$USER" "$DB" -v ON_ERROR_STOP=1 < "$BACKUP_FILE"
    ;;
esac

echo "Restauracion completada desde: $BACKUP_FILE"
