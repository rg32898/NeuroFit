#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# NeuroFit — single-command local bootstrap.
#
#   ./scripts/dev.sh
#
# Idempotent. Safe to re-run. Does NOT depend on Replit, Nix, or any
# proprietary tooling — only: bash, docker (with compose plugin), pnpm 9, node 20.
# -----------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

say() { printf "\033[1;36m▸ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m! %s\033[0m\n" "$*"; }

# 1. Ensure .env files exist ---------------------------------------------------
ensure_env() {
  local example="$1"
  local target="${example%.example}"
  if [[ ! -f "$target" ]]; then
    cp "$example" "$target"
    warn "created $target from $(basename "$example") — fill in any required keys"
  fi
}

say "Seeding .env files from .env.example"
ensure_env "$ROOT/.env.example"
ensure_env "$ROOT/artifacts/api-server/.env.example"
ensure_env "$ROOT/artifacts/admin/.env.example"
ensure_env "$ROOT/artifacts/mobile/.env.example"

# 2. Boot Postgres -------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  warn "docker not found — install Docker Desktop or Colima, then re-run."
  exit 1
fi
say "Starting Postgres (docker compose)"
docker compose up -d postgres

# 3. Install + migrate + seed --------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found — install with: corepack enable && corepack prepare pnpm@9 --activate"
  exit 1
fi

say "Installing workspace dependencies"
pnpm install

say "Running database migrations"
pnpm --filter @workspace/api-server run db:migrate

say "Seeding catalogue data"
pnpm --filter @workspace/api-server run db:seed || warn "seed script exited non-zero (may already be seeded — safe to ignore)"

# 4. Print next steps ----------------------------------------------------------
cat <<EOF

\033[1;32m✔ Bootstrap complete.\033[0m

Next steps — open three terminals:

  1) API server         pnpm --filter @workspace/api-server run dev
  2) Admin console      pnpm --filter @workspace/admin run dev
  3) Mobile (Expo)      pnpm --filter @workspace/mobile run dev

Then:
  • Admin UI:  http://localhost:3100/admin
  • API:       http://localhost:8080/api/healthz
  • Mobile:    scan the QR code printed by Expo with Expo Go

Stop Postgres later with:  docker compose down
Wipe the database with:    docker compose down -v

EOF
