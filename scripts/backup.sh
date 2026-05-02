#!/bin/sh

# Configuración
DB_PATH="./apps/backend/prisma/dev.db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_NAME="fuvex_backup_$TIMESTAMP.db"

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Realizar copia de seguridad
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_DIR/$BACKUP_NAME"
    echo "[$(date)] Backup exitoso: $BACKUP_NAME"
    
    # Rotación: Eliminar backups de más de 7 días
    find "$BACKUP_DIR" -name "fuvex_backup_*" -mtime +7 -exec rm {} \;
    echo "[$(date)] Rotación de backups completada."
else
    echo "[$(date)] ERROR: No se encontró la base de datos en $DB_PATH"
    exit 1
fi
