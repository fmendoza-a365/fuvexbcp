#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL es requerida. Ejemplo:"
  echo "DATABASE_URL='postgresql://fuvex:fuvex_dev_password@localhost:5433/fuvex?schema=public' npm run db:pg:migrate"
  exit 1
fi

cd "$ROOT_DIR/apps/backend"
npx prisma migrate deploy --schema prisma-postgres/schema.prisma
