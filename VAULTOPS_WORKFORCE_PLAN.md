# VaultOps workforce, RBAC, sharing & dashboard

**Auth choice (locked for this plan):** First-party invite + email verify + set password + login. Matches your description. Clerk/`dev-token` remain temporarily for local bootstrap only until this ships; SSO/Clerk can return later as an enterprise add-on.

---

## Current gaps vs your request

Today (`apps/api/prisma/schema.prisma`):

- `User` has only `clerkId` + `email` — no first/last name, no password, no invite/verify state
- Roles are only `admin` / `member` with coarse permissions (`seed.ts`)
- **No** `CredentialShare` (or equivalent) — every org member with `credential:read` sees the whole vault
- Employees page lists members but **cannot invite**
- No dashboard route; landing is thin marketing/home

---

## Proposed role model

Five org roles. Permissions are **capability-based**; sharing further restricts which credentials a non-admin actually sees.

| Role | Intent | Typical permissions |
|------|--------|---------------------|
| **Owner** | Org bootstrap / billing later | All permissions + transfer ownership + delete org (future) |
| **Admin** | Day-to-day security lead | Invite/remove employees, assign roles, full credential CRUD + reveal, manage all shares, view audit |
| **Editor** | Vault operators | Create/update credentials they can access; reveal; share with others; no delete-org / no role assign |
| **Viewer** | Need passwords occasionally | List + reveal **shared-with-me** (and own) only; no create/edit/delete/share |
| **Auditor** | Compliance | List metadata + read audit log; **no reveal** of secrets |

Permission keys:

- `employee:invite`, `employee:manage`, `role:assign`
- `credential:read`, `credential:write`, `credential:reveal`, `credential:delete`, `credential:share`
- `audit:read`
- `org:admin` (settings, encryption status for admins)

**Visibility rule (critical):** Admins/Owners see all org credentials. Editors/Viewers only see: credentials they created **or** that were shared with them. Auditors see metadata for shared/org scope without reveal.

---

## Employee invite → verify → password → login

1. Admin → `POST /employees` invite (first, last, email, role)
2. API creates user `invited` + hashed invite token; emails verify link
3. Employee opens link → set-password page → `POST /auth/set-password`
4. Employee → `POST /auth/login` → JWT Bearer

**Data model on `User`:** `firstName`, `lastName`, `passwordHash`, `emailVerifiedAt`, `status` (`invited` | `active` | `disabled`), `inviteTokenHash`, `inviteExpiresAt`. `clerkId` optional/nullable.

**Email:** `EMAIL_PROVIDER=console` logs magic link to API stdout in Docker/dev.

---

## Credential sharing

Table `CredentialShare`: `credentialId`, `userId`, `grantedById`, `createdAt`, unique `(credentialId, userId)`.

UI: Share searchable employee dropdown; show sharees + count; remove access.

Share = view + reveal only; editors still need `credential:write` to edit.

---

## Dashboard (default post-login home)

Route `/dashboard`: total credentials / by category, employees (active/invited), shares, recent audit, threat count.

---

## Gaps you did not mention

1. Who can invite — Admin + Owner only
2. Invite-only (no self-registration)
3. Password reset needed later
4. MFA deferred
5. Disable (not hard-delete) employees
6. Multi-org deferred
7. Groups/folders/bulk CSV later

---

## Success criteria

- Admin invites Jane → verify → set password → login
- Viewer sees only shared credentials and can reveal those
- Editor can share, see count/list, revoke
- Dashboard shows stats after login
- Invite/share/reveal audited
