#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

run() {
  printf '\n==> %s\n' "$*"
  "$@"
}

run npm audit
run npm run build:backend
run npm run test:backend
run npm run build:web
run npm run typecheck:mobile
printf '\n==> npx prisma validate --schema apps/backend/prisma/schema.prisma\n'
DATABASE_URL='file:../../../data/dev.db' npx prisma validate --schema apps/backend/prisma/schema.prisma

printf '\n==> npx prisma validate --schema apps/backend/prisma-postgres/schema.prisma\n'
DATABASE_URL='postgresql://fuvex:fuvex_dev_password@localhost:5433/fuvex?schema=public' npx prisma validate --schema apps/backend/prisma-postgres/schema.prisma
run docker compose -f docker-compose.postgres-local.yml config

if [ -f apps/backend/.env.production ]; then
  run npm run prod:env:check
  run docker compose -f docker-compose.prod.yml config
else
  printf '\nWARN: apps/backend/.env.production no existe; se omite validacion de entorno y compose productivo.\n'
  printf '      Crear desde apps/backend/.env.production.example cuando se vaya a probar staging/produccion.\n'
fi

printf '\nPreflight OK\n'
