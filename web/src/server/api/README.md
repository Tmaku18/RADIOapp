# Next.js API layer (strangler)

All `/api/{module}/...` requests flow through:

1. `web/src/app/api/[[...path]]/route.ts` (when `STRANGLER_ENABLED=true`)
2. `dispatchLocalApi()` → module handler if listed in `STRANGLER_LOCAL_MODULES`
3. Otherwise `proxyToLegacyBackend()` → Railway NestJS

## Ported modules

| Module | Handler | Notes |
|--------|---------|-------|
| `health` | `modules/health.ts` | Supabase ping |
| `auth` | `modules/auth.ts` | verify, cross-domain token |
| `users` | `modules/users.ts` | GET /me |
| `payments` | `modules/payments.ts` | POST /webhook (delegates to legacy by default) |

## All other modules

Registered in `modules/index.ts` with `legacyDelegateHandler` — routes through Next for observability, forwards to NestJS.

## Adding a port

1. Implement handler in `web/src/server/api/modules/{module}.ts`
2. Register in `PORTED_HANDLERS` in `modules/index.ts`
3. Add module to `STRANGLER_LOCAL_MODULES`
4. Run `pnpm --filter web test:api-parity`
