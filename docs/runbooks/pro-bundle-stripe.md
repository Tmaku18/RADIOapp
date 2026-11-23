# Pro Bundle Stripe Runbook

Pro Bundle unlocks **Pro-Radio + Pro-Networx** for **$12.99/mo**
(vs $14.98 if both solo plans are purchased: $4.99 Radio + $9.99 Networx).

## Pricing

| Field | Value |
| ----- | ----- |
| Regular | $12.99 USD / month |
| Solo comparison | $4.99 + $9.99 = $14.98 |
| Savings | $1.99 / month |
| Intro coupon | None (flat $12.99) |

Pricing constants (keep in sync):

- Web: `web/src/data/pro-bundle-pricing.ts`
- Mobile: `mobile/lib/core/constants/pro_bundle_pricing.dart`
- Backend: `backend/src/pro-bundle-subscription/pro-bundle-subscription.constants.ts`
- IAP SKU: `nwx_pro_bundle_monthly`

## Stripe setup

1. Product name: `Pro Bundle` — "Pro-Radio + Pro-Networx"
2. Recurring price: `12.99` USD monthly → copy the price ID to `STRIPE_PRO_BUNDLE_PRICE_ID`
3. Same webhook as other subs: `POST https://<api-host>/api/payments/webhook`. The handler routes `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` by price ID, and `setup_intent.succeeded` by `metadata.productKey = pro_bundle_subscription`.

Checkout / Payment Sheet routes:

- `POST /api/payments/create-pro-bundle-checkout-session` (web; defaults return to `/pro-radio?pro_bundle=success` / `canceled`)
- `POST /api/payments/create-pro-bundle-payment-sheet` (non-store clients; refused when `x-client-platform` is `ios` or `android`)

Completing, updating, or canceling a bundle writes the same status to both
`pro_radio_subscriptions` and `pro_network_subscriptions`.

## App Store / Play

Create `nwx_pro_bundle_monthly` at $12.99/mo in both consoles.
The Pro-Networx paywall on mobile offers the bundle first and falls back to the
solo plan when the store has no bundle product.
See `mobile/docs/APP_STORE_IAP.md`.
