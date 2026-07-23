# Mobile store billing (App Store + Google Play)

On **iOS** and **Android**, every digital purchase goes through the platform store — never Stripe.

| Purchase | iOS | Android | Web |
|----------|-----|---------|-----|
| Artist credits | App Store consumable | Play consumable | Stripe |
| Song plays / placements | App Store consumable | Play consumable | Stripe |
| Pro-Networx subscription | App Store auto-renewable | Play subscription | Stripe |
| Livestream tips | App Store consumable tiers | Play consumable tiers | Stripe |

Stripe Connect artist **payout** onboarding stays Stripe (not consumer IAP).

## Product IDs (create in both consoles)

### Credits (consumable)
- `nwx_credits_10` / `25` / `50` / `100`

### Discovery placements (consumable)
- `nwx_song_plays_1` / `3` / `5` / `10` / `25` / `50` / `100`

### Pro-Networx (subscription)
- Product ID: `nwx_pro_networx_monthly`
- Price: **$9.99/mo**, introductory first month **$4.99**
- App Store Connect: subscription group “Pro-Networx”, auto-renewable
- Play Console: subscription + base plan $9.99/mo + intro/offer $4.99 first period

### Livestream tips (consumable)
- `nwx_tip_199` ($1.99)
- `nwx_tip_499` ($4.99)
- `nwx_tip_999` ($9.99)
- `nwx_tip_2499` ($24.99)

Mobile tip UI only offers these presets (no custom dollar amount on device).

## App Store Connect checklist

1. Enable **In-App Purchase** on App ID `com.tmaktechnologies.networxradio`.
2. Create consumables above (credits, song plays, tips).
3. Create subscription group + `nwx_pro_networx_monthly` with intro offer.
4. App Store Server Notifications V2 →  
   `POST https://<API_HOST>/payments/app-store/notifications`
5. In-App Purchase API key (Issuer ID, Key ID, `.p8`) for backend verification.

## Google Play Console checklist

1. Confirm credit/play product IDs match App Store.
2. Create subscription `nwx_pro_networx_monthly` + tip consumables.
3. Real-time developer notifications (RTDN) → Pub/Sub push to  
   `POST https://<API_HOST>/payments/google-play/rtdn`
4. Service account with Android Publisher access for backend verify/acknowledge.

## Code (repo)

- Mobile: `PlayBillingService` (consumables + subscriptions + tip IDs).
- Mobile paywall: `ProNetworkPaywallSheet` → StoreKit / Play Billing + Restore.
- Mobile tips: `watch_live_screen.dart` store consumables on iOS/Android.
- Credits / plays: store-only on mobile; missing SKU → clear error (no Stripe fallback).
- API header: `x-client-platform: ios|android|web` — backend rejects Stripe intents for digital goods on mobile.
- Backend:  
  - `POST /payments/app-store/complete` (+ tips via `sessionId`)  
  - `POST /payments/google-play/complete`  
  - `POST /payments/app-store/complete-subscription`  
  - `POST /payments/google-play/complete-subscription`  
  - ASSN V2 + Play RTDN handlers above  
- DB: `pro_network_subscriptions.store` + Apple/Play id columns (migration `109_pro_network_store_billing.sql`).

## Backend env

See `backend/.env.example`. Defaults for product catalog live in
`backend/src/payments/iap-product-catalog.ts` and merge with:

```env
APPLE_IAP_BUNDLE_ID=com.tmaktechnologies.networxradio
APPLE_IAP_ENVIRONMENT=Sandbox
APPLE_APP_APPLE_ID=<numeric App Store Connect app id>
APPLE_IAP_KEY_ID=...
APPLE_IAP_ISSUER_ID=...
APPLE_IAP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_PLAY_PACKAGE_NAME=com.tmaktechnologies.networxradio
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=...
# Optional overrides (merged on top of defaults):
# APPLE_IAP_PRODUCT_CATALOG_JSON=
# GOOGLE_PLAY_PRODUCT_CATALOG_JSON=
```

## Mobile env (optional product ID overrides)

```env
IOS_APP_STORE_PRO_NETWORX_MONTHLY_PRODUCT_ID=nwx_pro_networx_monthly
ANDROID_PLAY_PRO_NETWORX_MONTHLY_PRODUCT_ID=nwx_pro_networx_monthly
IOS_APP_STORE_TIP_199_PRODUCT_ID=nwx_tip_199
# ... same pattern for 499 / 999 / 2499
```

## Verify

1. iOS Sandbox + Android license tester: credits, plays, tips — store UI only; grants land.
2. Subscribe Pro-Networx on each store → `getAccess()` true; Restore works; expire/revoke clears access.
3. No Stripe PaymentSheet on iOS/Android for those flows.
4. Web Stripe checkout / tips still work.

## What this is not

- **Apple Pay** / **Google Wallet** via Stripe are not used for these digital goods on mobile.
- Migrating existing Stripe Pro-Networx subscribers onto Apple/Play is out of scope.
