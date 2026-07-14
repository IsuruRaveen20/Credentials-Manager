# Postgres backup & restore (VaultOps)

Runbook for the Compose Postgres service (`postgres:16-alpine`, volume `vaultops_pg`).

## Prerequisites

- Docker Compose stack running (`docker compose up -d postgres` at minimum)
- Credentials from `.env` / Compose defaults: user `vaultops`, db `vaultops`, password `vaultops`
- Host port default **15432** (`POSTGRES_HOST_PORT`)

## Backup (logical dump)

Preferred for migrations and disaster recovery drills — portable SQL dump:

```bash
# From repo root; timestamped file under ./backups/
mkdir -p backups
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T postgres \
  pg_dump -U vaultops -d vaultops --format=custom --no-owner --no-acl \
  > "backups/vaultops-${STAMP}.dump"
```

Plain SQL alternative:

```bash
docker compose exec -T postgres \
  pg_dump -U vaultops -d vaultops --format=plain --no-owner \
  > "backups/vaultops-${STAMP}.sql"
```

Confirm the file is non-empty:

```bash
ls -lh backups/vaultops-*.dump | tail -1
```

Store copies off-machine (S3, encrypted USB, org backup vault). Treat dumps as **secret material** (encrypted credential ciphertext + PII).

## Restore (custom format)

**Warning:** restores overwrite data. Prefer a dedicated restore environment or stop the API first.

```bash
# Stop writers
docker compose stop api web

# Optional: drop & recreate public schema (destructive)
docker compose exec -T postgres \
  psql -U vaultops -d vaultops -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore from custom dump
cat backups/vaultops-YYYYMMDDTHHMMSSZ.dump | \
  docker compose exec -T postgres \
    pg_restore -U vaultops -d vaultops --clean --if-exists --no-owner --no-acl

docker compose start api web
```

Plain SQL:

```bash
cat backups/vaultops-YYYYMMDDTHHMMSSZ.sql | \
  docker compose exec -T postgres psql -U vaultops -d vaultops
```

## Volume-level snapshot (faster, less portable)

For host disk snapshots only (same Postgres major version required to revive):

```bash
docker compose stop postgres
# Snapshot Docker volume vaultops_pg via your host/backup tool, then:
docker compose start postgres
```

Prefer `pg_dump` for cross-machine restores.

## Staging drill checklist

1. Take a fresh dump from staging.
2. Restore into a scratch Compose project (different `COMPOSE_PROJECT_NAME` / volume).
3. Run `pnpm --filter @vaultops/api exec prisma migrate status` — schema should match.
4. Boot API against the restore DB; hit `/health` and sign in with a known admin.
5. Spot-check: org members, one credential list (metadata only), audit recent rows.
6. Record duration, dump size, and any failure modes in the ops log.
7. Destroy the scratch volume when done.

## Cron example (host)

```cron
15 2 * * * cd /path/to/webmee-credentials-manager && mkdir -p backups && docker compose exec -T postgres pg_dump -U vaultops -d vaultops -Fc --no-owner --no-acl > backups/vaultops-$(date -u +\%Y\%m\%dT\%H\%M\%SZ).dump && find backups -name 'vaultops-*.dump' -mtime +14 -delete
```

Adjust retention (`-mtime`) and offsite sync to match policy.
