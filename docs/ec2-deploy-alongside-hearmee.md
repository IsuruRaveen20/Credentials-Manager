# Deploying VaultOps alongside HearMee on the same EC2 box (no Docker)

**Server:** `ubuntu@32.194.190.28` (Elastic IP, survives stop/start) · t3.micro, 1GB RAM + 2GB swap · Ubuntu 24.04
**Already running:** HearMee — PM2 processes `hearmee-api` (:3001) + `hearmee-web` (:3000), Postgres 16 (`hearmee` DB), Nginx (`/etc/nginx/sites-available/hearmee`), Let's Encrypt cert for `hearmee.webmee.tech`.
**Adding:** VaultOps — PM2 processes `vaultops-api` (:4001) + `vaultops-web` (:4000), a new `vaultops` database on the **same** Postgres instance, a new Redis instance, a new Nginx site for `vault.webmee.tech`.

**Decisions locked in for this guide** (yours): fit VaultOps on the current t3.micro rather than resizing first; local envelope encryption (no AWS KMS setup); subdomain `vault.webmee.tech`.

Every step below either creates something new (new DB, new Nginx file, new PM2 processes) or is read-only. Nothing here edits `~/HearMee`, `hearmee-api`, `hearmee-web`, the `hearmee` database, or `/etc/nginx/sites-available/hearmee`. Where a step touches something shared (Postgres server, Nginx, PM2's saved process list), that's called out explicitly.

---

## 0. Before touching anything

A security fix was made to the app code before this guide was written: the API used to accept a hardcoded `Bearer dev-token` as an instant-admin login whenever Clerk wasn't configured — which is exactly this deployment's setup (password-only, no Clerk). That's now gated behind `ALLOW_DEV_TOKEN_AUTH`, which defaults to **off**. Just don't set that variable in the production `.env` (it's not in the steps below) and you're covered. Docker/local dev sets it to `true` automatically — no change needed there.

**Back up HearMee first, even though we're not touching it:**

```bash
ssh -i ~/Downloads/hearmee-ec2-keypair.pem ubuntu@32.194.190.28
bash ~/HearMee/scripts/db-backup.sh
free -h        # note current RAM/swap usage — you'll compare after VaultOps is up
pm2 status     # confirm hearmee-api / hearmee-web are online before you start
```

Keep this terminal's `pm2 status` / `pm2 logs hearmee-api` output in mind as your "is HearMee still fine" baseline through the rest of this guide.

---

## 1. DNS — point vault.webmee.tech at the same server

In Namecheap → Domain List → **webmee.tech** → Advanced DNS, add:

```
Type:  A Record
Host:  vault
Value: 32.194.190.28
TTL:   Automatic
```

This only adds a record — the existing `hearmee` A record is untouched. DNS can take a few minutes to propagate; kick this off now and it'll be ready by the time you reach the Nginx/certbot step.

```bash
# check from your laptop, not the server
nslookup vault.webmee.tech   # should eventually return 32.194.190.28
```

---

## 2. Postgres — new database on the existing server

HearMee already has PostgreSQL 16 running natively on this box (`localhost:5432`). VaultOps gets its **own database and user** on that same running instance — this is exactly how a shared Postgres server is meant to be used (RDS multi-tenant setups work the same way), and it does not touch the `hearmee` database at all.

```bash
sudo -u postgres psql <<EOF
CREATE DATABASE vaultops;
CREATE USER vaultops_user WITH ENCRYPTED PASSWORD 'CHANGE-THIS-STRONG-PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE vaultops TO vaultops_user;
\c vaultops
GRANT ALL ON SCHEMA public TO vaultops_user;
EOF
```

Verify both databases exist side by side:

```bash
sudo -u postgres psql -c "\l" | grep -E "hearmee|vaultops"
```

---

## 3. Redis — new install (HearMee doesn't use Redis, so nothing to conflict with)

VaultOps uses Redis only for small, self-expiring rate-limit counters (reveal-attempt throttling). Footprint is a few MB.

```bash
sudo apt update
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping   # should print PONG
```

Default Ubuntu config already binds Redis to `127.0.0.1` only (not exposed externally) — confirm:

```bash
sudo grep -E "^bind|^protected-mode" /etc/redis/redis.conf
```

Optional but sensible on a memory-tight box — cap Redis's own footprint (this data is tiny and disposable, no need for it to grow):

```bash
sudo sed -i 's/^# maxmemory .*/maxmemory 32mb/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
sudo systemctl restart redis-server
```

---

## 4. Clone the repo (separate directory from HearMee)

```bash
cd /home/ubuntu
git clone https://github.com/IsuruRaveen20/Credentials-Manager.git WebMee-Credentials-Manager-VaultOps
cd WebMee-Credentials-Manager-VaultOps
git checkout main   # or a tagged release once you start cutting them, same pattern as HearMee's v1.1.0 tags
```

> Actual clone directory name on the server: `~/WebMee-Credentials-Manager-VaultOps`. Every path below uses this exact name — if you ever clone fresh elsewhere with a different folder name, swap it consistently across every command and in `ecosystem.config.js`.

This uses the same global Node 20 / pnpm / PM2 that HearMee already uses — no reason to install a second copy, and re-using them doesn't change their versions (we're not running `npm install -g` again), so HearMee's toolchain is untouched.

```bash
node -v      # v20.x — already installed for HearMee
pnpm -v      # 9.14.x — already installed for HearMee, fine for this repo's pnpm@9.15.0 too
pm2 -v
```

---

## 5. Environment variables

Generate secrets:

```bash
# JWT signing secret
openssl rand -hex 32

# Local envelope-encryption master key — MUST decode to exactly 32 bytes, this does
openssl rand -base64 32

# A UUID for DEFAULT_ORGANIZATION_ID (any v4 UUID works)
python3 -c "import uuid; print(uuid.uuid4())"

# A strong admin password
openssl rand -base64 18
```

Create `/home/ubuntu/WebMee-Credentials-Manager-VaultOps/.env`:

```env
NODE_ENV=production

# --- Database (new DB on the existing Postgres instance) ---
DATABASE_URL=postgresql://vaultops_user:CHANGE-THIS-STRONG-PASSWORD@localhost:5432/vaultops?schema=public

# --- Redis (new instance, step 3) ---
REDIS_URL=redis://127.0.0.1:6379

# --- Auth ---
AUTH_MODE=password
AUTH_JWT_SECRET=<paste the openssl rand -hex 32 output>
# Leave this unset/false — see step 0.
# ALLOW_DEV_TOKEN_AUTH=false

# --- Bootstrap admin (this becomes your first login) ---
ADMIN_EMAIL=admin@webmee.tech
ADMIN_PASSWORD=<paste the generated admin password>
ADMIN_FIRST_NAME=WebMee
ADMIN_LAST_NAME=Admin
DEFAULT_ORGANIZATION_ID=<paste the generated UUID>

ALLOWED_EMAIL_DOMAINS=webmee.tech

# --- Local envelope encryption (your chosen KMS approach) ---
USE_LOCAL_KMS=true
KMS_PROVIDER=local
LOCAL_KMS_MASTER_KEY=<paste the openssl rand -base64 32 output>

# --- Email (console = invite links land in `pm2 logs vaultops-api`; switch to a
# real provider later if you want actual invite emails sent) ---
EMAIL_PROVIDER=console

# --- Web / API wiring ---
WEB_ORIGIN=https://vault.webmee.tech
NEXT_PUBLIC_API_URL=https://vault.webmee.tech/api
PORT=4001
```

Two things worth double-checking before moving on:

- **`LOCAL_KMS_MASTER_KEY` is the single most important secret in this file.** It's the root key every stored credential is encrypted under. Losing it means losing access to every secret in the vault — back it up somewhere separate from this server (a password manager entry, not just this `.env` file). Don't rotate or regenerate it later without a migration plan.
- `ADMIN_PASSWORD` here is just the bootstrap login — change it from the vault's own UI after first login if you want.

---

## 6. Install, build, migrate, seed

```bash
cd /home/ubuntu/WebMee-Credentials-Manager-VaultOps

# devDependencies are needed for the build step (tsc, prisma, ts-node for seeding)
NODE_ENV=development pnpm install --force

# Shared Zod schemas — both api and web depend on this
pnpm --filter @vaultops/shared build

# Load .env into this shell for the Prisma commands below.
# NOTE: if you re-run `export $(grep ...)` multiple times across a long session
# (e.g. after fixing a typo in .env), bash keeps the *first* exported value as the
# authoritative one for any variable name — plain re-assignment or editing the file
# again doesn't reliably clear it. If a Prisma command ever complains about a
# DATABASE_URL that doesn't match what's actually in the file, don't fight it —
# just pass it inline for that one command instead, which always wins regardless
# of shell history: `DATABASE_URL="postgresql://..." npx prisma migrate deploy`.
export $(grep -v '^#' /home/ubuntu/WebMee-Credentials-Manager-VaultOps/.env | grep -v '^$' | xargs)

cd apps/api
npx prisma generate
npx prisma migrate deploy      # creates all VaultOps tables in the new `vaultops` DB — does not touch `hearmee`
npx prisma db seed             # creates the admin user, default roles, and the three default groups
cd /home/ubuntu/WebMee-Credentials-Manager-VaultOps

# Build the API (NestJS -> dist/)
pnpm --filter @vaultops/api build

# Build the web app (Next.js, standalone output — already configured in next.config.ts)
NEXT_PUBLIC_API_URL=https://vault.webmee.tech/api pnpm --filter @vaultops/web build

# Standalone mode needs static assets + public/ copied in manually (same as HearMee's build)
cp -r apps/web/public apps/web/.next/standalone/apps/web/
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/
```

If `npx prisma db seed` complains about `ts-node: not found`, it means the `--force` on `pnpm install` didn't restore devDependencies — re-run `NODE_ENV=development pnpm install --force` and try again.

Confirm the seed worked:

```bash
sudo -u postgres psql -d vaultops -c "select email, status from \"User\";"
sudo -u postgres psql -d vaultops -c "select name from \"Group\";"
# Expect: your ADMIN_EMAIL as active, and Senior/Junior/New Developers as the three groups.
```

---

## 7. PM2 — new ecosystem file, new process names

**Before touching PM2, confirm section 6's build actually produced real output** — if it didn't, PM2 will just crash-loop on start instead of giving you a clear error:

```bash
ls -la /home/ubuntu/WebMee-Credentials-Manager-VaultOps/apps/api/dist/main.js
ls -la /home/ubuntu/WebMee-Credentials-Manager-VaultOps/apps/web/.next/standalone/apps/web/server.js
```

Both must exist before you continue. If either is missing, go back and finish the build commands in section 6.

`ecosystem.config.js` is committed at the repo root (unlike HearMee's, which only exists by hand on their server) — it's already in your clone after `git pull`, nothing to create here. It's a **separate file** from HearMee's `~/HearMee/ecosystem.config.js` — the two are never merged. The process names `vaultops-api` / `vaultops-web` are deliberately distinct from `hearmee-api` / `hearmee-web` so `pm2 status` / `pm2 logs` / `pm2 restart` always make it obvious which app you're targeting.

Just confirm the paths inside it match your actual clone location before starting it:

```bash
cat /home/ubuntu/WebMee-Credentials-Manager-VaultOps/ecosystem.config.js
```

It should reference `/home/ubuntu/WebMee-Credentials-Manager-VaultOps` throughout. If you ever clone to a different path, edit `cwd` / `env_file` / `script` in that file to match — it's the only place those paths live.

Start only these two — `pm2 start <ecosystem-file>` only starts/manages the apps **listed in that specific file**. It has no awareness of `hearmee-api` / `hearmee-web` at all (they were started from a different ecosystem file, `~/HearMee/ecosystem.config.js`), so this command cannot restart, reload, or otherwise touch them:

```bash
cd /home/ubuntu/WebMee-Credentials-Manager-VaultOps
pm2 start ecosystem.config.js
pm2 status   # confirm hearmee-api, hearmee-web, vaultops-api, vaultops-web are ALL online
```

Expect `pm2 status` to now show all four with the same `hearmee-api` / `hearmee-web` PID and uptime they had before this command (proof nothing was touched), plus two new rows for `vaultops-api` / `vaultops-web`.

If either new process shows `errored` or keeps restarting (`↺` climbing), check its logs before doing anything else:

```bash
pm2 logs vaultops-api --lines 50 --nostream
pm2 logs vaultops-web --lines 50 --nostream
```

Only save once you've confirmed all four are healthy — `pm2 save` snapshots whatever `pm2 list` shows right now, so a bad snapshot would still auto-restart existing processes on reboot, but there's no reason to save a shaky state:

```bash
pm2 save
```

`pm2 startup` was already configured for HearMee — that systemd unit runs `pm2 resurrect` on boot and will now bring back all four processes, not just HearMee's two. No need to run `pm2 startup` again.

---

## 8. Nginx — new site file, existing `hearmee` file untouched

Create `/etc/nginx/sites-available/vault`:

```nginx
server {
    listen 80;
    server_name vault.webmee.tech;

    location /api/ {
        proxy_pass http://localhost:4001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 8M;
    }

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it and test before reloading (`nginx -t` catches mistakes before they can affect the live HearMee config):

```bash
sudo ln -s /etc/nginx/sites-available/vault /etc/nginx/sites-enabled/vault
sudo nginx -t                        # must say "syntax is ok" / "test is successful"
sudo systemctl reload nginx          # reload, not restart — zero downtime for hearmee's existing connections
```

At this point `http://vault.webmee.tech` should load the app (once DNS from step 1 has propagated).

### SSL — Let's Encrypt via Certbot

Certbot is already installed from the HearMee setup. Running it with `-d vault.webmee.tech` only touches the `vault` site file (it matches by `server_name`, not by editing every file):

```bash
sudo certbot --nginx \
  -d vault.webmee.tech \
  --non-interactive --agree-tos \
  --email isururaveen4520@gmail.com

sudo certbot certificates          # confirm both hearmee.webmee.tech and vault.webmee.tech are listed
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9. Memory budget — the part that actually needs care

HearMee's own notes already flagged that this t3.micro (1GB RAM) needed 2GB of swap just to run `hearmee-api` (capped at 300M) + `hearmee-web` (capped at 450M) + Postgres. You've chosen to fit VaultOps on the same box rather than resizing, so here's the realistic budget:

| Process | Cap | Notes |
|---|---|---|
| hearmee-api | 300M | unchanged |
| hearmee-web | 450M | unchanged |
| vaultops-api | 220M | NestJS is somewhat heavier per-request than Fastify; capped tighter since this app is lower-traffic (internal tool) |
| vaultops-web | 280M | standalone Next.js output — smaller footprint than a full `next start` |
| Postgres (shared) | ~80–150M | one instance now serving two databases |
| Redis (new) | ~32M cap | set in step 3 |
| Nginx + OS | ~150–200M | |

Worst case sum is close to 1.5GB against 1GB RAM + 2GB swap (3GB virtual ceiling) — it should **not** OOM-kill anything, but expect noticeable swapping (slower responses on both apps) if HearMee and VaultOps both see traffic at the same moment. This is a real tradeoff you accepted by not resizing first; it's not silently fine.

**Watch for trouble right after deploying and periodically afterward:**

```bash
free -h                       # "available" should stay comfortably above 0; rising swap "used" over time is the warning sign
pm2 monit                     # live per-process CPU/RAM
dmesg -T | grep -i "out of memory" -A2   # any OOM-killer activity — should be empty
```

**If you see sustained swapping or an OOM kill:** the fastest safe mitigation is lowering `max_memory_restart` further on the VaultOps processes (PM2 will restart them cleanly if they exceed it, rather than the kernel OOM-killer picking a victim, which could hit HearMee's processes instead). The durable fix is resizing the instance:

```bash
# from your laptop, AWS CLI, or the console:
aws ec2 stop-instances --instance-ids i-098a81a8ca735234a
aws ec2 modify-instance-attribute --instance-id i-098a81a8ca735234a --instance-type t3.small
aws ec2 start-instances --instance-ids i-098a81a8ca735234a
```

The Elastic IP (`32.194.190.28`) stays attached across stop/start, so DNS doesn't need to change. Total downtime for **both** apps during this is roughly 1–2 minutes (instance reboot) — do it in a maintenance window if you go this route later. `pm2 startup`'s systemd unit will bring all four processes back automatically.

---

## 10. Verify everything

```bash
pm2 status
# hearmee-api    online
# hearmee-web    online
# vaultops-api   online
# vaultops-web   online

pm2 logs vaultops-api --lines 30 --nostream
pm2 logs vaultops-web --lines 30 --nostream
```

Then in a browser:
- `https://hearmee.webmee.tech` — still loads, existing data intact (your HearMee regression check).
- `https://vault.webmee.tech/login` — log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
- Confirm **Groups** in the sidebar shows the three seeded groups (Senior/Junior/New Developers), and that adding a credential + sharing it with a group works.

---

## 11. Backups for the new database

Mirror HearMee's own backup pattern, pointed at the new DB. Create `/home/ubuntu/WebMee-Credentials-Manager-VaultOps/scripts/db-backup.sh`:

```bash
#!/bin/bash
set -e
BACKUP_DIR=/home/ubuntu/WebMee-Credentials-Manager-VaultOps/backups
mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
PGPASSWORD='CHANGE-THIS-STRONG-PASSWORD' pg_dump -U vaultops_user -h localhost vaultops \
  | gzip > "$BACKUP_DIR/vaultops_${TS}.sql.gz"
find "$BACKUP_DIR" -name "vaultops_*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /home/ubuntu/WebMee-Credentials-Manager-VaultOps/scripts/db-backup.sh
bash /home/ubuntu/WebMee-Credentials-Manager-VaultOps/scripts/db-backup.sh
ls -lht /home/ubuntu/WebMee-Credentials-Manager-VaultOps/backups | head -3
```

Cron (staggered from HearMee's 3 AM backup so both dumps don't hit disk I/O at the same moment):

```bash
crontab -e
# add:
0 4 * * * bash /home/ubuntu/WebMee-Credentials-Manager-VaultOps/scripts/db-backup.sh >> /home/ubuntu/WebMee-Credentials-Manager-VaultOps/backups/backup.log 2>&1
```

---

## 12. Redeploying updates later

Same shape as HearMee's `Commands-Deploy.md`, applied to `~/WebMee-Credentials-Manager-VaultOps`:

```bash
cd ~/WebMee-Credentials-Manager-VaultOps
git pull origin main
NODE_ENV=development pnpm install --force
pnpm --filter @vaultops/shared build

export $(grep -v '^#' /home/ubuntu/WebMee-Credentials-Manager-VaultOps/.env | xargs)
cd apps/api && npx prisma migrate deploy && npx prisma generate && cd ../..

pnpm --filter @vaultops/api build
NEXT_PUBLIC_API_URL=https://vault.webmee.tech/api pnpm --filter @vaultops/web build
cp -r apps/web/public apps/web/.next/standalone/apps/web/
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/

pm2 restart vaultops-api --update-env
pm2 restart vaultops-web --update-env
pm2 save
```

Note the `--update-env` flag — HearMee's own `PM2-env-email-issue-fix.md` documents exactly why this matters: without it, a running PM2 process keeps its old environment even after you change `.env`.

This never runs `pm2 restart hearmee-*` or `pm2 restart all`, so HearMee is unaffected by a VaultOps redeploy.

---

## 13. If you need to remove VaultOps entirely (rollback)

```bash
pm2 delete vaultops-api vaultops-web
pm2 save                                      # updates the saved list to no longer include them
sudo rm /etc/nginx/sites-enabled/vault
sudo nginx -t && sudo systemctl reload nginx
sudo certbot delete --cert-name vault.webmee.tech
# Database is left in place unless you explicitly want it gone:
# sudo -u postgres psql -c "DROP DATABASE vaultops;"
```

`hearmee-api`, `hearmee-web`, the `hearmee` database, and `/etc/nginx/sites-available/hearmee` are never referenced by any of the above.
