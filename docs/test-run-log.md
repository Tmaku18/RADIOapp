# Test Run Log

## Run 1

- **Date/time:** 2026-01-30 11:40:18
- **Environment:** Local servers (backend `http://localhost:3005`, web `http://localhost:3002`) using staging Firebase/Supabase/Stripe projects
- **Git SHA:** a43c3ef9e7052fddfff0e21543b2f568b9742ac2
- **Test operator:** Cursor agent

### Notes

- Updated `@nestjs/config` to resolve Nest peer dependency mismatch.
- Local Redis started via Docker (`radioapp-redis`).
- Backend moved to port 3005 (port 3000 in use); web moved to 3002 (port 3001 in use).
- Seed script executed successfully; test accounts created for listener/artist/admin and baseline songs/fallback/chat/notifications inserted.
- Backend unit tests executed (`npm run test:cov`): 20 test suites passing; overall coverage ~15%.
- API matrix script executed successfully (`backend/scripts/run-api-matrix.js`).
- Radio logic smoke checks completed (`backend/scripts/run-radio-logic-tests.js`).
- Integration checks completed (`backend/scripts/run-integration-tests.js`): signed upload URL + Stripe PaymentIntent/CheckoutSession created (no payment confirmation).
- E2E happy path scripted (`backend/scripts/run-e2e-happy-path.js`): core steps executed; pending approve/reject skipped when no pending song present.
- Perf tests executed (`backend/scripts/run-perf-tests.js`, scaled): radio-current ~32 req/s avg (p99 ~5905ms), chat-status ~63 req/s (p99 ~1102ms), chat-send ~22.9 req/s (p99 ~1043ms).
- Security checks executed (`backend/scripts/run-security-checks.js`): auth required, role guard, webhook signature rejection, signed URL expiry, shadow ban suppression, rate limit burst.
