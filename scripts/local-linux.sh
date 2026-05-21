#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/apps/backend/.env"
LOG_DIR="$ROOT_DIR/.local-run/logs"
ADB_BIN="${ADB_BIN:-/home/fmendoza/Android/Sdk/platform-tools/adb}"
START_WEB="${START_WEB:-1}"
START_MOBILE="${START_MOBILE:-1}"

export ANDROID_HOME="${ANDROID_HOME:-/home/fmendoza/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

mkdir -p "$LOG_DIR"

cd "$ROOT_DIR"

info() {
  printf '\033[1;34m[local]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[local]\033[0m %s\n' "$*"
}

ensure_env() {
  if [ -f "$BACKEND_ENV" ]; then
    return
  fi

  warn "No existe apps/backend/.env; creando configuracion local."
  local secret
  secret="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
  cat > "$BACKEND_ENV" <<ENV
PORT=3001
DATABASE_URL="file:../../../data/prod.db"
JWT_SECRET=${secret}
CORS_ORIGINS=http://localhost:3001,http://localhost:5173
SEED_ADMIN_PASSWORD=ChangeMe123!
ENV
}

ensure_dependencies() {
  if [ ! -d "$ROOT_DIR/node_modules" ]; then
    info "Instalando dependencias npm..."
    npm install
  fi
}

prepare_database() {
  info "Preparando Prisma y base local..."
  DATABASE_URL="${DATABASE_URL:-file:../../../data/prod.db}" npx prisma generate --schema apps/backend/prisma/schema.prisma
  DATABASE_URL="${DATABASE_URL:-file:../../../data/prod.db}" npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
  DATABASE_URL="${DATABASE_URL:-file:../../../data/prod.db}" npx prisma db seed --schema apps/backend/prisma/schema.prisma
}

setup_adb_reverse() {
  if [ "$START_MOBILE" != "1" ]; then
    return
  fi

  if [ ! -x "$ADB_BIN" ]; then
    warn "ADB no encontrado en $ADB_BIN; omitiendo reverse USB."
    return
  fi

  if "$ADB_BIN" get-state >/dev/null 2>&1; then
    info "Aplicando adb reverse para backend y Metro..."
    "$ADB_BIN" reverse tcp:3001 tcp:3001 || true
    "$ADB_BIN" reverse tcp:8081 tcp:8081 || true
    "$ADB_BIN" reverse --list || true
  else
    warn "No hay dispositivo ADB autorizado; conecta el celular y acepta la huella RSA."
  fi
}

wait_for_backend() {
  info "Esperando backend en http://localhost:3001/api/health..."
  for _ in $(seq 1 40); do
    if curl -fsS http://localhost:3001/api/health >/dev/null 2>&1; then
      curl -fsS http://localhost:3001/api/ready >/dev/null
      info "Backend listo."
      return
    fi
    sleep 1
  done

  warn "El backend no respondio a tiempo. Revisa $LOG_DIR/backend.log"
  return 1
}

pids=()

start_process() {
  local name="$1"
  shift
  local log_file="$LOG_DIR/${name}.log"
  info "Arrancando $name. Log: $log_file"
  "$@" >"$log_file" 2>&1 &
  pids+=("$!")
}

cleanup() {
  if [ "${#pids[@]}" -gt 0 ]; then
    warn "Deteniendo procesos locales..."
    kill "${pids[@]}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

ensure_env
ensure_dependencies
prepare_database
setup_adb_reverse

start_process backend npm run dev --workspace backend
wait_for_backend

if [ "$START_WEB" = "1" ]; then
  start_process web npm run dev --workspace web -- --host 0.0.0.0
fi

if [ "$START_MOBILE" = "1" ]; then
  start_process mobile env EXPO_PUBLIC_API_URL=http://localhost:3001/api npm run start --workspace mobile -- --localhost
fi

info "Sistema local levantado."
info "API: http://localhost:3001/api/health"
if [ "$START_WEB" = "1" ]; then
  info "Web: http://localhost:5173"
fi
if [ "$START_MOBILE" = "1" ]; then
  info "Metro/Expo: revisa $LOG_DIR/mobile.log"
fi
info "Usuario seed: admin / ChangeMe123! si la base era nueva."
info "Presiona Ctrl+C para detener backend, web y Metro."

wait
