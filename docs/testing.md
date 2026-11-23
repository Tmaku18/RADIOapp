# Testing runbook

Automated coverage for API endpoints, Nest contracts, Flutter routes and helpers, critical in-app journeys, app builds, and a public web smoke check.

## What "green" means

| Suite | Command | Pass criteria |
| --- | --- | --- |
| Backend unit | `cd backend && npm test` | All Jest specs under `backend/src/**/*.spec.ts` pass (controllers, services, guards, pricing, billing policy) |
| Route inventory + auth matrix | `cd backend && npm run test:routes` | Inventory regenerates; every non-public route returns `401` without auth; role gates return `403` for wrong role |
| Mobile unit/widget | `cd mobile && flutter test` | All route, deep-link, API failover, radio sync, billing, and critical-journey smoke tests under `mobile/test/` pass |
| Mobile integration (device) | `cd mobile && flutter test integration_test/app_smoke_test.dart` | Same journeys on a connected emulator/device |
| Web smoke | `cd web && npm run test:e2e` | Playwright loads the site and finds "networx" in the title |

CI (`.github/workflows/test.yml`) runs on every push to `main`/`master` and every PR:

- **backend** — `npm test -- --ci --forceExit` and `npm run test:routes` (Node 22)
- **mobile** — `flutter test`
- **mobile-apk** — `flutter build apk --debug`
- **mobile-ipa** — `flutter build ios --no-codesign` (macOS runner)
- **web-smoke** — `npx playwright test` (Chromium)

The device integration job is in the workflow file but commented out until an emulator runner is available.

## Backend

```bash
cd backend
npm ci
npm test
npm run test:cov             # unit tests with coverage
npm run test:routes          # regenerates test/route-inventory.json then runs the auth matrix
npm run test:e2e             # all test/*.e2e-spec.ts (auth matrix + app health)
```

- Inventory script: `scripts/list-routes.ts` → `test/route-inventory.json`
- Auth matrix: `test/routes.auth.e2e-spec.ts` (Firebase/Supabase mocked; headers `x-test-uid` / `x-test-role`)
- App health e2e: `test/app.e2e-spec.ts` (`GET /api/app/version` is public; `GET /api/users/me` needs auth)
- Live server scripts under `scripts/run-*.js` (API matrix, radio logic, integration, e2e happy path, perf, security) still need a running API + Firebase; prefer the Jest matrix in CI

## Mobile

```bash
cd mobile
flutter pub get
flutter test
flutter test integration_test/app_smoke_test.dart   # device/emulator required
```

Unit tests in `mobile/test/`:

- `core/navigation/app_router_test.dart` — every `AppRoutes` name resolves; bad arguments fall back to the unknown route
- `core/navigation/app_link_test.dart` — shared song, artist, custom-scheme station, and referral links parse; other hosts are ignored
- `core/api_host_failover_test.dart` — API host failover (GET retries on 402/502; POST retries only on 402)
- `core/services/api_service_tls_test.dart` — TLS handshake error detection
- `core/radio/radio_sync_test.dart`, `core/services/radio_service_test.dart` — radio sync and station state
- `core/audio/headphone_route_test.dart` — which audio outputs count as headphones
- `core/services/play_billing_service_test.dart`, `core/constants/song_price_tiers_test.dart` — store billing helpers and price tiers
- `core/services/invite_service_test.dart`, `core/upload_progress_test.dart`, `features/nearby/nearby_grouping_test.dart`
- `smoke/critical_journeys_test.dart` — critical-journey smoke (below)

Critical journeys covered by smoke (no production traffic):

- App boots to welcome when Firebase is disabled
- Tabs switch, and named routes open: Nearby, Upload, Settings, Pro-Networx landing, artist profile
- Pro-Networx paywall bottom sheet presents

## Web

```bash
cd web
npm install
npx playwright install chromium
npm run test:e2e
```

`web/playwright.config.ts` runs `web/e2e/*.spec.ts` against `PLAYWRIGHT_BASE_URL`, defaulting to `https://www.networxradio.com`. Set `PLAYWRIGHT_BASE_URL=http://localhost:3001` to test a local `npm run dev`.

## Out of scope (for now)

- Hitting production/Railway with real tokens
- Full Stripe / App Store / Google Play purchase UI automation
- Signed release builds in CI (store builds are made locally)
