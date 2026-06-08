# Infrastructure pivot — cutover checklist

Branch: `pivot/radioapp-monolith`

**Staging isolation (keep production safe):** [PIVOT_STAGING.md](PIVOT_STAGING.md)

## Phase 1 — Strangler (current)

- [x] `STRANGLER_ENABLED=true` routes `/api/*` through Next.js catch-all
- [x] Local handlers: `health`, `auth`, `users`, `payments` (webhook)
- [x] All other modules proxy to Railway NestJS via `legacy-proxy`
- [ ] Expand `STRANGLER_LOCAL_MODULES` module-by-module after parity tests

## Phase 2 — Auth

- [ ] Apply migrations `087`, `088` to Supabase
- [ ] Run Firebase → Supabase user import (`firebase-to-supabase`)
- [ ] Backfill `users.auth_user_id`
- [ ] Set `NEXT_PUBLIC_AUTH_PRIMARY=supabase` on staging
- [ ] Keep `AUTH_FIREBASE_FALLBACK=true` until soak complete

## Phase 3 — RLS

- [ ] Verify policies with `pnpm test:rls` (live DB)
- [ ] Add SECURITY DEFINER RPCs for credit allocation / rotation as modules port

## Phase 4 — Radio worker

- [ ] Deploy `workers/radio` to Railway alongside Redis
- [ ] Point `RADIO_WORKER_URL` at worker health endpoint
- [ ] Port full `radio.service` tick loop into worker

## Phase 5 — Edge Functions

- [ ] Deploy `supabase/functions/scheduled-cleanup` with pg_cron trigger
- [ ] Optional: `stripe-webhook` edge relay

## Phase 6 — Mobile

- [ ] PWA parity matrix green
- [ ] `capacitor sync` → App Store / Play Store builds
- [ ] Flutter maintenance mode

## Phase 7 — Cutover

- [ ] `STRANGLER_LOCAL_ALL=true`
- [ ] Remove `BACKEND_URL` rewrite (NestJS decommission)
- [ ] Retire `pro-web/` and `admin/` Vercel projects
- [ ] Archive `mobile/` Flutter app

## Rollback

1. Set `STRANGLER_ENABLED=false` (restores next.config legacy rewrites)
2. Set `NEXT_PUBLIC_AUTH_PRIMARY=firebase`
3. Redeploy previous Vercel + Railway images
