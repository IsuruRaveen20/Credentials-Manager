#!/bin/sh
# Shared bootstrap for api/web containers: enable pnpm, install once, build shared.
set -eu

corepack enable
corepack prepare pnpm@9.15.0 --activate

MARKER="/app/node_modules/.vaultops-install-ok"
NEED_INSTALL=1
if [ -d /app/node_modules/.pnpm ] && [ -f "$MARKER" ] && [ -f /app/pnpm-lock.yaml ]; then
  # Re-install when the lockfile is newer than the last successful install.
  if [ ! /app/pnpm-lock.yaml -nt "$MARKER" ]; then
    NEED_INSTALL=0
  fi
fi

if [ "$NEED_INSTALL" = "1" ]; then
  echo "[vaultops] pnpm install (deps missing or lockfile changed)"
  pnpm install
  touch "$MARKER"
else
  echo "[vaultops] skipping pnpm install (cached node_modules volume)"
fi

pnpm --filter @vaultops/shared build
