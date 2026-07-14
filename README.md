# VaultOps · WebMee

Internal credential vault for [WebMee](https://webmee.tech/) — store shared logins (username/email + password, API secrets), invite employees, and audit access. **Public registration is disabled**; only invited users and the seeded admin can sign in.

**Author:** Isuru Raveen — [isururaveen4520@gmail.com](mailto:isururaveen4520@gmail.com)

## Tech stack

| Layer | Stack |
|-------|--------|
| Monorepo | **pnpm** workspaces (`apps/*`, `packages/*`) |
| Web | **Next.js 15** (App Router + Turbopack), **React 19**, **TypeScript**, **Tailwind CSS**, Radix UI primitives, Lucide, Framer Motion, React Hook Form + Zod |
| Auth (web) | First-party password JWT + optional **Clerk** (`@clerk/nextjs`) |
| API | **NestJS 10**, Prisma, **jose** (JWT/JWKS), bcrypt, Helmet, Throttler |
| Data | **PostgreSQL 16**, **Redis 7** |
| Crypto | Application-layer AES-256-GCM envelope encryption; **AWS KMS** SDK (local KMS in Docker) |
| Shared | `@vaultops/shared` — Zod schemas / types |
| Observability | **Sentry** (`@sentry/nextjs`, `@sentry/node`) |
| Infra (local) | **Docker Compose** — `infra/docker/*` |

| Package | Path |
|---------|------|
| `@vaultops/web` | `apps/web` — UI (Compose host port **13000**) |
| `@vaultops/api` | `apps/api` — REST API (Compose host port **13001**) |
| `@vaultops/shared` | `packages/shared` |

## Prerequisites

- Docker + Docker Compose
- Node 20+ and `pnpm` (optional for host-side work; Compose installs pnpm in containers)

## Quick start (Docker)

```bash
cp .env.example .env
# Edit ADMIN_EMAIL / ADMIN_PASSWORD (and other secrets) before first seed
docker compose up --build
```

| Service | URL |
|---------|-----|
| Web     | http://localhost:13000 |
| API     | http://localhost:13001/health |

Sign in at http://localhost:13000/login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

### Important `.env` keys

| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap owner admin — upserted into Postgres on every `prisma db seed` |
| `ADMIN_FIRST_NAME` / `ADMIN_LAST_NAME` | Display name for admin |
| `AUTH_MODE` | `hybrid` (default): password JWT + optional Clerk + `dev-token` |
| `AUTH_JWT_SECRET` | JWT signing secret (change in production) |
| `ALLOWED_EMAIL_DOMAINS` | e.g. `webmee.tech` — restricts Clerk/domain checks |
| `NEXT_PUBLIC_API_URL` | Browser → API (`http://localhost:13001`) |
| `WEB_ORIGIN` | CORS for the web app (`http://localhost:13000`) |
| `DEFAULT_ORGANIZATION_ID` | Must match seed (`00000000-0000-4000-8000-000000000001`) |
| `CLERK_JWKS_URL` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional Clerk — see `.env.example` |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Optional Sentry |

Compose defaults: web **13000**, API **13001**, Postgres **15432**, Redis **16379**.

### Employees (no public signup)

1. Admin signs in.
2. **Employees** → invite (email + role).
3. With `EMAIL_PROVIDER=console`, the invite URL is printed in API logs (and returned in the API response).
4. Invitee opens `/accept-invite?token=…`, sets a password, then uses `/login`.

## Local development (without Docker for apps)

```bash
pnpm install
pnpm --filter @vaultops/shared build
cd apps/api && pnpm exec prisma migrate deploy && pnpm exec prisma db seed
pnpm --filter @vaultops/api dev
# other terminal  
pnpm --filter @vaultops/web dev
```

Use `DATABASE_URL` / `REDIS_URL` pointing at Compose Postgres/Redis (or your own instances).

## Repo layout

| Path | Used by runtime? | Notes |
|------|------------------|--------|
| `apps/web` | **Yes** | Next.js app |
| `apps/api` | **Yes** | NestJS + Prisma |
| `packages/shared` | **Yes** | Shared Zod / types |
| `infra/docker` | **Yes** | Dev Dockerfiles + bootstrap |
| `docs/` | Docs only | e.g. Postgres backup runbook |
| `docker-compose.yml` | **Yes** | Local stack |
| `UI:UX/` | **No** | Design-system reference / static kits — **safe to remove** from the product repo if you no longer need mocks |
| `infra/terraform/` | **No** (yet) | Stub `main.tf` — keep only if you plan AWS deploy soon |
| `scripts/` | Optional | LocalStack KMS helper — only if you use LocalStack |
| `VAULTOPS_WORKFORCE_PLAN.md` | **No** | Historical product plan — most items shipped |
| `.cursor/plans/` | **No** | Agent plans only |
| `.pnpm-store/` | **No** | Local pnpm cache — should stay gitignored / not committed |

## Features notes

- **Categories** — free-form when adding a credential (Vault → Add credential). Normalized to Title Case (`database` → `Database`).
- **Login types** — Username + password, Email + password, or Secret only.
- **Theme** — Light / dark toggle in the top bar.
- **Branding** — WebMee logo in shell and auth; © WebMee · [webmee.tech](https://webmee.tech/).
- **Ops** — Backup/restore: [`docs/postgres-backup-restore.md`](docs/postgres-backup-restore.md).

## Agent notes

See [`AGENTS.md`](AGENTS.md) for conventions when working in this repo with AI agents.

## Security

- Never commit real production `.env` values or KMS keys.
- Rotate `ADMIN_PASSWORD` after first deploy.
- Prefer Cloudflare / private networking in front of the API for production.
