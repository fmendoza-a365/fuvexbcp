# Operacion PostgreSQL Y Docker

Guia para probar PostgreSQL, Docker, backups y despliegue futuro en DigitalOcean.

## PostgreSQL Local

Levantar base:

```bash
docker compose -f docker-compose.postgres-local.yml up -d
```

Migrar y sembrar:

```bash
DATABASE_URL='postgresql://fuvex:fuvex_dev_password@localhost:5433/fuvex?schema=public' npm run db:pg:migrate
DATABASE_URL='postgresql://fuvex:fuvex_dev_password@localhost:5433/fuvex?schema=public' SEED_ADMIN_PASSWORD='ChangeMe123!' npm run db:pg:seed
```

El usuario seed es `admin` y la clave depende de `SEED_ADMIN_PASSWORD` cuando el usuario no existe.

## Staging O Produccion Con Docker

Crear env:

```bash
cp apps/backend/.env.production.example apps/backend/.env.production
```

Editar valores reales antes de levantar:

- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `CORS_ORIGINS`
- `INFOBURO_USER`
- `INFOBURO_PASS`
- `SEED_ADMIN_PASSWORD`
- variables S3 si se usa Spaces.

Validar:

```bash
npm run prod:env:check
docker compose -f docker-compose.prod.yml config
```

Levantar:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app
```

El contenedor ejecuta `prisma migrate deploy` antes de arrancar la API.

## Healthchecks

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/ready
```

- `/api/health`: proceso vivo.
- `/api/ready`: API lista y PostgreSQL consultable.

Docker usa `/api/ready` como healthcheck.

## DigitalOcean

Opciones validas:

- Droplet + PostgreSQL en contenedor: mas barato, mas responsabilidad operativa.
- Droplet + DigitalOcean Managed PostgreSQL: mejor para produccion y backups administrados.
- Documentos en DigitalOcean Spaces si se quiere evitar depender del disco de la Droplet.

La app escucha en `3001`. En produccion conviene poner Nginx o Caddy delante para HTTPS.

## Backups

Crear backup:

```bash
npm run db:pg:backup
```

Para contenedor local:

```bash
POSTGRES_CONTAINER=fuvex_postgres_local npm run db:pg:backup
```

Restaurar:

```bash
npm run db:pg:restore -- backups/postgres/fuvex_YYYYMMDD_HHMMSS.sql.gz
```

Restaurar reemplazando schema actual:

```bash
RESET_DATABASE=confirm npm run db:pg:restore -- backups/postgres/fuvex_YYYYMMDD_HHMMSS.sql.gz
```

Probar restore solo en staging o base de prueba.

## Storage Documental

Local:

```env
STORAGE_PROVIDER=local
STORAGE_ROOT=/app/storage/expedientes
```

DigitalOcean Spaces / S3:

```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_REGION=nyc3
S3_BUCKET=nombre-del-space
S3_ACCESS_KEY_ID=access-key
S3_SECRET_ACCESS_KEY=secret-key
S3_FORCE_PATH_STYLE=false
```

El frontend no cambia; el backend decide si guarda en disco o S3.
