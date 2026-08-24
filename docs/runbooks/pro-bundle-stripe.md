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

Display constants (keep in sync):

- Web: `web/src/data/pro-bundle-pricing.ts`
- Mobile: `mobile/lib/core/constants/pro_bundle_pricing.dart`
- Backend: `backend/src/pro-bundle-subscription/pro-bundle-subscription.constants.ts`
- IAP SKU: `nwx_pro_bundle_monthly`

## Stripe setup

1. Product name: `Pro Bundle` — “Pro-Radio + Pro-Networx”
2. Recurring price: `12.99` USD monthly → copy `price_xxx` to `STRIPE_PRO_BUNDLE_PRICE_ID`
3. Same webhook as other subs: `POST /payments/webhook`

Checkout / Payment Sheet routes:

- `POST /payments/create-pro-bundle-checkout-session`
- `POST /payments/create-pro-bundle-payment-sheet`

Completing a bundle purchase writes **active** rows to both
`pro_radio_subscriptions` and `pro_network_subscriptions`.

## App Store / Play

Create `nwx_pro_bundle_monthly` at $12.99/mo in both consoles.
See `mobile/docs/APP_STORE_IAP.md`.
