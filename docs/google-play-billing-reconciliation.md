# Google Play Billing Reconciliation Notes

This document explains how Android purchases are reconciled after migrating from
in-app Stripe to Google Play Billing.

## Flow summary

1. Android app completes a Google Play Billing purchase.
2. App sends `productId` and `purchaseToken` to:
   - `POST /api/payments/google-play/complete`
3. Backend verifies purchase with Android Publisher API.
4. Backend records transaction with `payment_method=google_play`.
5. Backend grants entitlements:
   - credit products -> increment artist credits
   - song plays products -> increment `songs.credits_remaining` for `songId`

## Required backend environment

- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (or Firebase credentials with Play access)
- `GOOGLE_PLAY_PRODUCT_CATALOG_JSON` (server-side mapping from product ID to value)

## Transaction table mapping (Google Play)

- `stripe_charge_id`: Google Play `orderId` (used as idempotency key)
- `stripe_payment_intent_id`: Google Play `purchaseToken`
- `payment_method`: `google_play`
- `status`: `succeeded` when verification passes and entitlement is granted

## Operational guidance

- Finance/support should filter `transactions` by `payment_method`:
  - `google_play` for Android in-app purchases
  - `checkout_session` or Stripe intent/session IDs for web/non-Android flows
- Keep product IDs and `GOOGLE_PLAY_PRODUCT_CATALOG_JSON` aligned with Play Console.
- If catalog values change (price or quantity), update env and redeploy backend before
  publishing the app version that references the new IDs.
