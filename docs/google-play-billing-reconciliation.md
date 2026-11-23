# Google Play Billing Reconciliation Notes

This document explains how Android purchases are reconciled now that every
digital purchase on Android goes through Google Play Billing. Product IDs and
prices are listed in `mobile/docs/APP_STORE_IAP.md`.

## Flow summary

### One-time products

1. Android app completes a Google Play Billing purchase.
2. App sends `productId`, `purchaseToken`, and the context ID (`songId` or livestream `sessionId`) to:
   - `POST /api/payments/google-play/complete`
3. Backend verifies the purchase with the Android Publisher API and maps the product through the IAP catalog (`backend/src/payments/iap-product-catalog.ts`, merged with `GOOGLE_PLAY_PRODUCT_CATALOG_JSON`).
4. Backend grants the entitlement by product type:
   - Discovery placements (`nwx_song_plays_*`) → recorded in `transactions` and added to `songs.credits_remaining` for `songId`. Each placement is 100 verified exposures, and packs include bonus placements (3→+1, 5→+2, 10→+4, 25→+10, 50→+20, 100→+40). The product amount must match `packPriceCents()` in `backend/src/payments/payments.service.ts`.
   - Song / beat purchases (`nwx_song_*`) → `song_purchases` row with `store = google_play` and `payout_status = 'pending'`. The SKU amount must equal the song's listed price.
   - Livestream tips (`nwx_tip_*`) → tip recorded against the live session.
   - Refinery submission (`nwx_refinery_submission`) → the song is enrolled in The Refinery.
   - Credit packs (`nwx_credits_*`) are no longer sold; the backend rejects them.

### Subscriptions

- Pro-Networx, Pro-Radio, and Pro Bundle complete through `POST /api/payments/google-play/complete-subscription`.
- Renewals, cancellations, and expirations arrive as Real-time developer notifications at `POST /api/payments/google-play/rtdn` and update the subscription rows.

## Required backend environment

- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (or `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` with Android Publisher access)
- `GOOGLE_PLAY_PRODUCT_CATALOG_JSON` (optional overrides merged on top of the default catalog)

## Transaction table mapping (Google Play placements)

- `stripe_charge_id`: Google Play `orderId` (used as idempotency key)
- `stripe_payment_intent_id`: Google Play `purchaseToken`
- `payment_method`: `google_play`
- `song_id` / `plays_purchased`: the song and number of placements bought
- `status`: `succeeded` when verification passes and entitlement is granted

Re-sending the same `orderId` returns `alreadyProcessed` without a second grant.

## Operational guidance

- Finance/support should filter `transactions` by `payment_method`:
  - `google_play` for Android in-app purchases
  - `checkout_session` or Stripe intent/session IDs for web flows
- Song and beat sales live in `song_purchases`, filtered by `store`. Store sales stay `payout_status = 'pending'` until an admin settles them from the payout queue (`GET /api/admin/payouts/pending`, `POST /api/admin/payouts/:artistId/settle`), which sends a Stripe Connect transfer once the artist's account can receive payouts.
- Keep product IDs and prices in Play Console aligned with the IAP catalog.
- Placement options come from `GET /api/payments/song-play-price?songId=...` (placements, bonus placements, exposures, total cents).
- If catalog values change (price or quantity), update the catalog or env and redeploy the backend before publishing the app version that references the new IDs.
