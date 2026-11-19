#!/usr/bin/env bash
# Smoke test hlavního průchodu nad izolovaným stackem (BACKLOG QA-01).
# Použití (na serveru, z kořene repa):  tools/smoke/run.sh
#   SMOKE_API_IMAGE / SMOKE_MIGRATE_IMAGE – jiné image (výchozí :latest)
#   SMOKE_PORT – lokální port API (výchozí 3901), SMOKE_KEEP=1 – stack nechat běžet
#   SMOKE_WEB_IMAGE, SMOKE_WEB_PORT (3902), SMOKE_BROWSER=0 – bez browser E2E (QA-02)
set -euo pipefail
cd "$(dirname "$0")"

PROJECT=tagery-smoke
COMPOSE=(docker compose -p "$PROJECT" -f docker-compose.smoke.yml)
export SMOKE_PORT="${SMOKE_PORT:-3901}"
export SMOKE_JWT_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
export SMOKE_BILLING_SECRET="whsec_$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"

cleanup() {
  if [ "${SMOKE_KEEP:-}" != "1" ]; then
    # Odstraní jen kontejnery a svazky projektu tagery-smoke.
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "▶ smoke stack: postgres + redis"
"${COMPOSE[@]}" up -d postgres redis >/dev/null
echo "▶ migrace + seed (SEED_DEMO=1)"
"${COMPOSE[@]}" run --rm migrate >/tmp/tagery-smoke-migrate.log 2>&1 || {
  tail -40 /tmp/tagery-smoke-migrate.log
  exit 1
}
echo "▶ API na 127.0.0.1:$SMOKE_PORT"
"${COMPOSE[@]}" up -d api >/dev/null
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$SMOKE_PORT/api/v1/health" >/dev/null; then break; fi
  sleep 2
done
curl -sf "http://127.0.0.1:$SMOKE_PORT/api/v1/health" >/dev/null || {
  "${COMPOSE[@]}" logs --tail 40 api
  exit 1
}

mkdir -p .out
SMOKE_OUT="$PWD/.out/smoke.json" SMOKE_BASE_URL="http://127.0.0.1:$SMOKE_PORT/api/v1" node main-flow.mjs

# BACKLOG QA-02: browser E2E (Playwright) nad stejným stackem.
if [ "${SMOKE_BROWSER:-1}" != "0" ]; then
  export SMOKE_WEB_PORT="${SMOKE_WEB_PORT:-3902}"
  echo "▶ web na 127.0.0.1:$SMOKE_WEB_PORT"
  "${COMPOSE[@]}" up -d web >/dev/null
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null "http://127.0.0.1:$SMOKE_WEB_PORT/login"; then break; fi
    sleep 2
  done
  curl -sf -o /dev/null "http://127.0.0.1:$SMOKE_WEB_PORT/login" || {
    "${COMPOSE[@]}" logs --tail 40 web
    exit 1
  }
  echo "▶ browser E2E (Playwright)"
  "${COMPOSE[@]}" --profile e2e run --rm e2e || {
    "${COMPOSE[@]}" logs --tail 30 web api
    exit 1
  }
fi
