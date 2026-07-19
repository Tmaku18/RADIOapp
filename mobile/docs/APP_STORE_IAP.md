# Apple In-App Purchase (iOS)

Digital credits and discovery placements on iOS use **Apple In-App Purchase (StoreKit)**, not Stripe / Apple Pay. Android continues to use Google Play Billing. Web continues to use Stripe Checkout.

## Code (done in repo)

- Mobile: `PlayBillingService` + purchase screens call StoreKit on iOS.
- Mobile API: `POST payments/app-store/complete` via `PaymentsService.completeAppStorePurchase`.
- Backend: `AppStoreBillingService` verifies StoreKit 2 JWS (and can look up by transaction id) using `@apple/app-store-server-library`.
- Product IDs default to the same strings as Android (`nwx_credits_*`, `nwx_song_plays_*`).

## App Store Connect (required once)

1. Enable **In-App Purchase** on App ID `com.tmaktechnologies.networxradio`.
2. In App Store Connect → your app → **Monetization → In-App Purchases**, create **Consumable** products, for example:
   - `nwx_credits_10` / `25` / `50` / `100`
   - `nwx_song_plays_1` / `3` / `5` / `10` / `25` / `50` / `100`
   - Or priced SKUs matching your Play map, e.g. `nwx_song_plays_5_995` for 5×$1.99
3. Submit products for review with the app (or as needed for your release track).
4. Create an **In-App Purchase** API key:
   - Users and Access → Integrations → In-App Purchase → Generate
   - Save **Issuer ID**, **Key ID**, and the `.p8` private key

## Backend env

Set in `backend/.env` (see `.env.example`):

```env
APPLE_IAP_BUNDLE_ID=com.tmaktechnologies.networxradio
APPLE_IAP_ENVIRONMENT=Sandbox
APPLE_APP_APPLE_ID=<numeric App Store Connect app id>
APPLE_IAP_KEY_ID=...
APPLE_IAP_ISSUER_ID=...
APPLE_IAP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# Reuse Play catalog if product IDs match:
# APPLE_IAP_PRODUCT_CATALOG_JSON=
GOOGLE_PLAY_PRODUCT_CATALOG_JSON={"nwx_credits_10":{"type":"credits","amountCents":999,"credits":10},...}
```

Apple root CA files live in `backend/certs/apple/` (committed).

## Mobile env (optional overrides)

Same product IDs work on both stores by default. Optional iOS-only overrides:

```env
IOS_APP_STORE_CREDITS_10_PRODUCT_ID=nwx_credits_10
IOS_APP_STORE_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON={"1:199":"nwx_song_plays_1_199","5:995":"nwx_song_plays_5_995"}
```

## Verify

1. Use a Sandbox Apple ID on a real device / TestFlight.
2. Artist account → Purchase Credits → complete an IAP.
3. Confirm backend logs a succeeded `payment_method: app_store` transaction and credits increase.
4. Repeat for discovery placements on a song.
5. Replay the same transaction id → API returns `alreadyProcessed: true`.

## What this is not

- **Apple Pay** / **Google Wallet** are wallet payment methods (often via Stripe on web). They are not required for digital IAP.
- Pro Network / Connect / web song checkout may still use Stripe where App Store rules allow (or must move to auto-renewable IAP if sold inside the iOS app as digital subscriptions).
