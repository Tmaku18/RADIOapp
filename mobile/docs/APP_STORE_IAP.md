# Mobile store billing (App Store + Google Play)

On **iOS** and **Android**, every digital purchase goes through the platform store — never Stripe.

| Purchase | iOS | Android | Web |
|----------|-----|---------|-----|
| Discovery placements (per song) | App Store consumable | Play consumable | Stripe |
| Pro-Networx subscription | App Store auto-renewable | Play subscription | Stripe |
| Pro-Radio subscription | App Store auto-renewable | Play subscription | Stripe |
| Pro Bundle subscription | App Store auto-renewable | Play subscription | Stripe |
| Livestream tips | App Store consumable tiers | Play consumable tiers | Stripe |
| Song / beat purchases | App Store consumable tiers | Play consumable tiers | Stripe |
| Refinery submission | App Store consumable | Play consumable | Stripe |

Stripe Connect artist **payout** onboarding stays Stripe (not consumer IAP).

The app ships **worldwide**, so there are no external web-checkout links anywhere
in the mobile UI. Apple only allows link-outs on the US storefront, and Google
Play requires enrolling in its external content links program — neither covers a
worldwide release.

Creator Network subscription has **no store SKU**, so its Stripe route stays
web-only and is rejected on mobile.

**Beta switch:** with `BETA_ALL_FREE=true` on the backend, Pro-Radio,
Pro-Networx, and Creator Network unlock without a purchase while the paywalls
keep showing prices. It defaults to paid. Refinery submissions follow the same
switch unless `REFINERY_FREE_SUBMISSIONS` is set. One-off purchases
(placements, songs, tips) always charge.

## Product IDs (create in both consoles)

### Credits (retired)
- `nwx_credits_10` / `25` / `50` / `100` are still listed in the catalog and
  `Configuration.storekit`, but credit packs are no longer sold. No mobile
  screen offers them, and the backend rejects them with "Credit packages are
  no longer sold." Do not create them; remove them from sale if they exist.

### Discovery placements (consumable)
- `nwx_song_plays_1` — $1.99
- `nwx_song_plays_3` — $4.99 (+1 bonus placement)
- `nwx_song_plays_5` — $9.99 (+2)
- `nwx_song_plays_10` — $17.99 (+4)
- `nwx_song_plays_25` — $39.99 (+10)
- `nwx_song_plays_50` — $75.99 (+20)
- `nwx_song_plays_100` — $150.00 (+40)
- Each placement (paid or bonus) adds 100 verified exposures to the song's
  `songs.credits_remaining`. Bought per song from My Songs → Buy placements
  (`buy_plays_screen.dart`).
- The server checks the store price against these amounts (`packPriceCents()`
  in `backend/src/payments/payments.service.ts`). Change the price on each SKU
  in App Store Connect and Google Play Console to match.

### Pro-Networx (subscription)
- Product ID: `nwx_pro_networx_monthly`
- Price: **$9.99/mo**, introductory first month **$4.99**
- App Store Connect: subscription group “Pro-Networx”, auto-renewable
- Play Console: subscription + base plan $9.99/mo + intro/offer $4.99 first period

### Pro-Radio (subscription)
- Product ID: `nwx_pro_radio_monthly`
- Price: **$4.99/mo**, introductory first month **$1.99**
- App Store Connect: subscription group “Pro-Radio”, auto-renewable
- Play Console: subscription + base plan $4.99/mo + intro/offer $1.99 first period
- Unlocks on-demand full streams for opted-in songs (separate from live Networx Radio)

### Pro Bundle (subscription) — recommended if you want both
- Product ID: `nwx_pro_bundle_monthly`
- Price: **$12.99/mo** (Pro-Radio + Pro-Networx)
- Saves vs buying both singly ($4.99 + $9.99 = $14.98)
- Completing this purchase grants **both** access rows server-side
- App Store Connect / Play Console: create as its own auto-renewable subscription
- Stripe (web): `STRIPE_PRO_BUNDLE_PRICE_ID`

### Refinery submission (consumable)
- Product ID: `nwx_refinery_submission`
- Price: **$4.99** (was $9.99 — display as sale)
- One purchase per song submission; must be a **consumable** so artists can submit multiple songs
- Completing the purchase enrolls that song in The Refinery (server-side)
- Studio → Add to Refinery uses this SKU on iOS/Android; web still uses Stripe Checkout
- While submissions are free (see the beta switch above), the app adds the song without a purchase

### Livestream tips (consumable)
- `nwx_tip_199` ($1.99)
- `nwx_tip_499` ($4.99)
- `nwx_tip_999` ($9.99)
- `nwx_tip_2499` ($24.99)

Mobile tip UI only offers these presets (no custom dollar amount on device).

### Song / beat purchases (consumable)

Artists set a price, but stores can only sell pre-registered products at fixed
prices. Prices are therefore snapped onto a fixed ladder, and each tier has one
SKU that is **reused across every song at that price**:

| Product ID | Price |
|------------|-------|
| `nwx_song_099` | $0.99 |
| `nwx_song_199` | $1.99 |
| `nwx_song_299` | $2.99 |
| `nwx_song_499` | $4.99 |
| `nwx_song_999` | $9.99 |
| `nwx_song_1999` | $19.99 |
| `nwx_song_2999` | $29.99 |
| `nwx_song_4999` | $49.99 |

**These must be consumables, not non-consumables.** A non-consumable could only
be purchased once per account, which would block buying a second song at the
same price. Ownership lives server-side in `song_purchases` (unique per
buyer+song), so "restore" is inherent to the account and needs no restore flow.

The backend rejects the purchase unless the SKU's amount equals the song's
listed price, so a $0.99 SKU cannot unlock a $49.99 beat.

Ladder source of truth: `backend/src/payments/song-price-tiers.ts` and
`mobile/lib/core/constants/song_price_tiers.dart`. Changing it requires new
console products and a migration — `songs.price_cents` has a CHECK constraint
pinned to these values.

**Payouts:** store purchases carry no Stripe Connect destination charge, so the
platform collects and owes the artist. These rows land as
`song_purchases.payout_status = 'pending'` and show in the admin payout queue.
An admin settles them with `POST /api/admin/payouts/:artistId/settle`, which
sends one Stripe Connect transfer once the artist's account can receive
payouts and marks the rows `paid`.

## App Store Connect checklist

1. Enable **In-App Purchase** on App ID `com.tmaktechnologies.networxradio`.
2. Create consumables above (placements, tips, song/beat tiers, **refinery submission**).
3. Create subscription group + `nwx_pro_networx_monthly` with intro offer.
4. Create subscription group + `nwx_pro_radio_monthly` with intro offer ($1.99 first month).
5. Create subscription + `nwx_pro_bundle_monthly` at **$12.99/mo** (both Pros).
6. App Store Server Notifications V2 →  
   `POST https://<API_HOST>/api/payments/app-store/notifications`
7. In-App Purchase API key (Issuer ID, Key ID, `.p8`) for backend verification.

For the eight `nwx_song_*` tiers: type **Consumable**, price point matching the
table above, and one localization each (display name + description) or StoreKit
returns zero products. A generic name like "Song purchase — $4.99" works, since
the SKU is shared across every song at that price.

## Google Play Console checklist

1. Create the seven `nwx_song_plays_*` placement products with the same IDs and prices as App Store.
2. Create subscription `nwx_pro_networx_monthly` + tip consumables.
3. Create subscription `nwx_pro_radio_monthly` with matching intro pricing.
4. Create subscription `nwx_pro_bundle_monthly` at $12.99/mo.
5. Create consumable `nwx_refinery_submission` at $4.99.
6. Create the eight `nwx_song_*` tiers as **in-app products** (consumable) at the
   same prices as App Store Connect.
7. Real-time developer notifications (RTDN) → Pub/Sub push to  
   `POST https://<API_HOST>/api/payments/google-play/rtdn`
8. Service account with Android Publisher access for backend verify/acknowledge.

## Code (repo)

- Mobile: `PlayBillingService` (consumables + subscriptions + tip/song IDs).
- Mobile paywall: `ProNetworkPaywallSheet` → StoreKit / Play Billing + Restore.
- Pro-Radio paywall: `ProRadioPaywallSheet` → same store flow for `nwx_pro_radio_monthly`.
- Mobile tips: `watch_live_screen.dart` store consumables on iOS/Android.
- Mobile song/beat buys: `SongPurchaseFlow` — shared by the player, artist
  profile, and beat marketplace. Store consumable on iOS/Android, Stripe on web.
- Placements: `buy_plays_screen.dart`, store-only on mobile; missing SKU → clear error (no Stripe fallback).
- Refinery: `RefinerySubmissionFlow` → free add, store consumable, or web Stripe.
- API header: `x-client-platform: ios|android|web` — backend rejects Stripe intents for digital goods on mobile via `assertStripeAllowedForDigitalGoods` (`backend/src/payments/store-billing-policy.ts`).
- Backend (all under `/api`):  
  - `POST /payments/app-store/complete` (+ tips via `sessionId`, song buys, placements, and Refinery via `songId`)  
  - `POST /payments/google-play/complete`  
  - `POST /payments/app-store/complete-subscription`  
  - `POST /payments/google-play/complete-subscription`  
  - ASSN V2 + Play RTDN handlers above  
- DB: `pro_network_subscriptions.store` + Apple/Play id columns (migration `109_pro_network_store_billing.sql`);
  `songs.price_cents` tier constraint (`117_song_price_tiers.sql`);
  `song_purchases.store` + `store_transaction_id` (`118_song_purchases_store_billing.sql`).

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
# Beta switches (default paid):
# BETA_ALL_FREE=false
# REFINERY_FREE_SUBMISSIONS=
```

`APPLE_TEAM_ID` plus the `APPLE_IAP_KEY_ID` / `APPLE_IAP_PRIVATE_KEY` key also
let account deletion revoke Sign in with Apple tokens.

## Mobile env (optional product ID overrides)

```env
IOS_APP_STORE_SONG_PLAYS_1_PRODUCT_ID=nwx_song_plays_1
ANDROID_PLAY_SONG_PLAYS_1_PRODUCT_ID=nwx_song_plays_1
# ... same pattern for 3 / 5 / 10 / 25 / 50 / 100
IOS_APP_STORE_PRO_NETWORX_MONTHLY_PRODUCT_ID=nwx_pro_networx_monthly
ANDROID_PLAY_PRO_NETWORX_MONTHLY_PRODUCT_ID=nwx_pro_networx_monthly
IOS_APP_STORE_PRO_RADIO_MONTHLY_PRODUCT_ID=nwx_pro_radio_monthly
ANDROID_PLAY_PRO_RADIO_MONTHLY_PRODUCT_ID=nwx_pro_radio_monthly
IOS_APP_STORE_PRO_BUNDLE_MONTHLY_PRODUCT_ID=nwx_pro_bundle_monthly
ANDROID_PLAY_PRO_BUNDLE_MONTHLY_PRODUCT_ID=nwx_pro_bundle_monthly
IOS_APP_STORE_REFINERY_SUBMISSION_PRODUCT_ID=nwx_refinery_submission
ANDROID_PLAY_REFINERY_SUBMISSION_PRODUCT_ID=nwx_refinery_submission
IOS_APP_STORE_TIP_199_PRODUCT_ID=nwx_tip_199
# ... same pattern for 499 / 999 / 2499
IOS_APP_STORE_SONG_PURCHASE_499_PRODUCT_ID=nwx_song_499
ANDROID_PLAY_SONG_PURCHASE_499_PRODUCT_ID=nwx_song_499
# ... same pattern for 099 / 199 / 299 / 999 / 1999 / 2999 / 4999
```

## Verify

1. iOS Sandbox + Android license tester: placements (with bonus), tips, Refinery submission — store UI only; grants land.
2. Subscribe Pro-Networx on each store → `getAccess()` true; Restore works; expire/revoke clears access.
3. No Stripe PaymentSheet on iOS/Android for those flows.
4. Buy a song from the player, an artist profile, and the beat marketplace →
   store sheet opens (never a browser), track unlocks, and `song_purchases` gets
   `store = app_store|google_play` with `payout_status = 'pending'`.
5. Re-send the same store receipt → second call returns `alreadyProcessed`, no
   duplicate row.
6. No "Open web checkout instead" button in Buy placements on device.
7. Run subscription checks with `BETA_ALL_FREE=false`; with it on, access is granted without a purchase.
8. Web Stripe checkout / tips / song buys still work.

## Troubleshooting: `StoreKit: Failed to get response from platform`

This is Apple returning **zero products** for the queried SKU (usually
`nwx_pro_networx_monthly`). It is almost never a Flutter code bug.

Fix in **App Store Connect** (in order):

1. **Agreements** → Paid Apps Agreement, Banking, and Tax are **Active**.
2. **Subscriptions** → group “Pro-Networx” → product ID exactly
   `nwx_pro_networx_monthly` with at least one **localization** (display name +
   description).
3. Add the **$9.99/mo** price and a **$4.99 intro offer** (first month).
4. Product status must not be blank / missing metadata. “Ready to Submit” is
   enough for Sandbox; Waiting for Review with incomplete metadata often fails.
5. On the test device: **Settings → Developer → Sandbox Apple Account** (or
   sign out of a production App Store account before Sandbox testing).
6. After creating/editing the product, wait a few minutes, force-quit the app,
   retry. The paywall now prefetches the SKU and shows a Retry button.

Local Xcode testing: open `ios/Runner.xcworkspace` → Product → Scheme → Edit
Scheme → Run → Options → StoreKit Configuration →
`Configuration.storekit`.

## What this is not

- **Apple Pay** / **Google Wallet** via Stripe are not used for these digital goods on mobile.
- Migrating existing Stripe Pro-Networx subscribers onto Apple/Play is out of scope.
