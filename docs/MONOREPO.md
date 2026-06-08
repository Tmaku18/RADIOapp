# Monorepo layout (pivot/radioapp-monolith)

pnpm workspaces unify deployable apps and shared packages:

| Path | Role |
|------|------|
| `web/` | **Monolith target** — marketing, auth, dashboard, Pro-Networx routes, admin, API strangler |
| `pro-web/` | Legacy Pro-Networx app (retire after `MONOLITH_PRO_ENABLED`) |
| `admin/` | Legacy standalone admin (retire after `MONOLITH_ADMIN_ENABLED`) |
| `packages/db` | Supabase service client, dual-auth resolution |
| `packages/ui` | Shared UI primitives |
| `packages/api-client` | API module path helpers |
| `workers/radio` | Retained Redis radio worker (emoji flush, health) |
| `capacitor/` | PWA native shell (push, camera, geo) |
| `supabase/functions` | Edge Functions (webhooks, scheduled cleanup) |
| `backend/` | Legacy NestJS (strangler proxy target until cutover) |

## Commands

```bash
pnpm install
pnpm dev:web          # Next.js monolith :3001
pnpm dev:worker       # Radio worker :3099
```

## Domain routing (middleware)

- `pro-networx.com` → `/pro-networx/*` (existing)
- `admin.networxradio.com` → `/admin/*` when `MONOLITH_ADMIN_ENABLED=true`

## Pro-web / admin merge status

Pro-Networx routes already live in `web/src/app/(ProNetworx)/`. Standalone `pro-web/` remains for production until DNS points to the monolith.

Admin tools live in `web/src/app/(dashboard)/admin/` (full) and `admin/` (legacy slim). Enable `MONOLITH_ADMIN_ENABLED` to serve admin subdomain from the monolith.
