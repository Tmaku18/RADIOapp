# Testing runbook

Automated coverage for API endpoints, Nest contracts, Flutter routes, and critical in-app journeys.

## What “green” means

| Suite | Command | Pass criteria |
| --- | --- | --- |
| Backend unit | `cd backend && npm test` | All Jest controller/service specs pass |
| Route inventory + auth matrix | `cd backend && npm run test:routes` | Inventory regenerates; every non-public route returns `401` without auth; role gates return `403` for wrong role |
| Mobile unit/widget | `cd mobile && flutter test` | All route resolve tests, billing helpers, nearby grouping, and critical-journey smoke pass |
| Mobile integration (device) | `cd mobile && flutter test integration_test` | Same journeys on a connected emulator/device |

CI (`.github/workflows/test.yml`) runs backend unit + `test:routes` and `flutter test` on every PR. Integration smoke is documented for local/nightly use (needs a device).

## Backend

```bash
cd backend
npm ci
npm test
npm run test:routes          # regenerates test/route-inventory.json then runs auth e2e
npm run test:e2e             # full e2e config (includes auth matrix)
```

- Inventory script: `scripts/list-routes.ts` → `test/route-inventory.json`
- Auth matrix: `test/routes.auth.e2e-spec.ts` (Firebase/Supabase mocked; headers `x-test-uid` / `x-test-role`)
- Live server scripts under `scripts/run-*.js` still need a running API + Firebase; prefer the Jest matrix in CI

## Mobile

```bash
cd mobile
flutter pub get
flutter test
flutter test integration_test/app_smoke_test.dart   # device/emulator required
```

Critical journeys covered by smoke (no production traffic):

- App boots to welcome when Firebase is disabled
- Named routes open: Discover, Nearby, Upload, Settings, Pro-Networx landing, artist profile
- Pro-Networx paywall bottom sheet presents

## Out of scope (for now)

- Hitting production/Railway with real tokens
- Full Stripe / App Store purchase UI automation
- Web Playwright suite
