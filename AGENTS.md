# AGENTS.md — VaultOps / WebMee credentials manager

Guidance for coding agents working in this repository.

**Author:** Isuru Raveen — isururaveen4520@gmail.com  
**Product:** Internal WebMee credential vault ([webmee.tech](https://webmee.tech/))  
**Auth model:** Invite-only. No public registration. Admin is seeded from `.env`.

## Repo layout

| Path | Role |
|------|------|
| `apps/web` | Next.js 15 UI (port 13000 in Docker) |
| `apps/api` | NestJS API (port 13001 in Docker) |
| `packages/shared` | Shared Zod schemas (`@vaultops/shared`) |
| `apps/api/prisma` | Schema, migrations, `seed.ts` |
| `infra/docker` | Dev Dockerfiles + bootstrap |
| `.env` / `.env.example` | Local + Compose env (admin credentials, ports, KMS) |

## How to run

```bash
cp .env.example .env   # set ADMIN_EMAIL / ADMIN_PASSWORD
docker compose up --build
```

- Web: http://localhost:13000 — Login: `/login`
- API health: http://localhost:13001/health
- After seed: sign in with values from `ADMIN_EMAIL` / `ADMIN_PASSWORD`

Re-seed (upserts admin + title-cases categories):

```bash
pnpm --filter @vaultops/api exec prisma db seed
# or via Compose restart (seed runs on API container start)
```

## Auth rules (do not break)

1. **No public signup routes** — access is `/login` + invite accept (`/accept-invite`).
2. **Admin** comes from `ADMIN_*` env vars → `apps/api/prisma/seed.ts`.
3. **Employees** are invited from `/employees` (requires `employee:invite`).
4. Bearer token: JWT from `/auth/login` stored as `vaultops_access_token` in localStorage. Fallback `dev-token` only for hybrid/dev.

## Categories & credentials

- Categories are **not** a fixed enum. Users type them on **Add credential**.
- Schema: `packages/shared/src/schemas/credential.ts` — `normalizeCategory` → Title Case.
- Login kinds: `username` | `email` | `none`.
- Sidebar categories: `GET /credentials/categories`.

## UI conventions

- Shell: `apps/web/src/components/app-shell.tsx` — WebMee logo, theme toggle, Sign in / Log out, footer.
- Theme: `data-theme="dark|light"` on `<html>` via `ThemeProvider`.
- Dashboard list padding: use `.vo-sidecard-body` + `.vo-dash-list-row` (not flush-to-border custom padding).
- Logo asset: `apps/web/public/webmee-logo.png`.

## When changing API or shared schemas

1. Edit `packages/shared` → `pnpm --filter @vaultops/shared build`
2. Update Nest services / Prisma as needed
3. Prefer migrate for schema; seed for bootstrap users/roles

## Don’ts

- Don’t add open registration endpoints.
- Don’t hard-code category lists in the sidebar.
- Don’t commit secrets; keep production passwords out of git.
- Don’t skip hooks or force-push unless the user explicitly asks.

## Quick file map for common tasks

| Task | Start here |
|------|------------|
| Login / JWT | `apps/api/src/auth/password-auth.*` |
| Seed admin | `apps/api/prisma/seed.ts`, `.env` `ADMIN_*` |
| Dashboard UI | `apps/web/src/app/(app)/dashboard/page.tsx` |
| App chrome | `apps/web/src/components/app-shell.tsx`, `globals.css` |
| Add credential | `apps/web/src/components/add-credential-dialog.tsx` |
