#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:5173}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"

echo "Health backend"
curl -fsS "$BASE_URL/api/health" >/dev/null

echo "Readiness backend"
curl -fsS "$BASE_URL/api/ready" >/dev/null

echo "Login"
TOKEN="$(curl -fsS -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>process.stdout.write(JSON.parse(s).token));")"

echo "Kanban"
curl -fsS "$BASE_URL/api/analytics/kanban" -H "Authorization: Bearer $TOKEN" >/dev/null

echo "Dashboard"
curl -fsS "$BASE_URL/api/analytics/dashboard" -H "Authorization: Bearer $TOKEN" >/dev/null

echo "Web"
curl -fsSI "$WEB_URL" >/dev/null

echo "Smoke OK"
