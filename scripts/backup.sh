#!/bin/sh

set -eu

DB_PATH="${DB_PATH:-./data/prod.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="fuvex_backup_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR/$BACKUP_NAME"
    echo "[$(date)] Backup exitoso: $BACKUP_NAME"

    find "$BACKUP_DIR" -name "fuvex_backup_*" -mtime +7 -exec rm {} \;
    echo "[$(date)] Rotacion de backups completada."
else
    echo "[$(date)] ERROR: No se encontro la base de datos en $DB_PATH"
    exit 1
fi
