# Pro-Radio Stripe Runbook

This runbook covers Stripe configuration for the Pro-Radio subscription ($4.99 /
month with a $1.99 promotional first month). Pro-Radio is **on-demand** listening
and playlists — it does not change live Networks Radio rotation or sync.

## Pricing model

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| Regular price    | $4.99 USD / month                        |
| Intro price      | $1.99 USD (first invoice only, one-time) |
| Billing interval | `month`, `interval_count = 1`            |
| Currency         | `usd`                                    |
| Trial            | None — discount is applied via coupon    |
| Store SKU        | `nwx_pro_radio_monthly`                  |

Intro eligibility uses `ProRadioSubscriptionService.hasNeverSubscribed(userId)`.

Pricing constants (keep in sync):

- Web: `web/src/data/pro-radio-pricing.ts`
- Mobile: `mobile/lib/core/constants/pro_radio_pricing.dart`
- Backend: `backend/src/pro-radio-subscription/pro-radio-subscription.constants.ts`

Pro-Radio is also included in the Pro Bundle ([pro-bundle-stripe.md](pro-bundle-stripe.md)).

## Stripe dashboard setup

### 1. Product

- Name: `Pro-Radio Subscription`
- Description: `On-demand full tracks and personal playlists on Networks Radio.`
- Statement descriptor: `NETWORX RADIO` (or your account default)

### 2. Recurring price (regular)

- Price: `4.99` USD, monthly
- Copy the price ID → `STRIPE_PRO_RADIO_PRICE_ID`

### 3. Intro coupon

- Name: `Pro-Radio First Month`
- Type: **Amount off** — `3.00` USD (4.99 − 3.00 = 1.99 first invoice)
- Duration: **Once**
- Copy coupon id → `STRIPE_PRO_RADIO_INTRO_COUPON_ID`

### 4. Webhook endpoint

Same endpoint as other subscriptions: `POST https://<api-host>/api/payments/webhook`

Events (shared handler, routed by price ID `STRIPE_PRO_RADIO_PRICE_ID`):

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `setup_intent.succeeded` (`metadata.productKey = pro_radio_subscription`)

## Routes

| Route | Client |
| ----- | ------ |
| `POST /api/payments/create-pro-radio-checkout-session` | Web Checkout (defaults return to `/pro-radio?pro_radio=success` / `canceled`) |
| `POST /api/payments/create-pro-radio-payment-sheet` | Payment Sheet for non-store clients (refused when `x-client-platform` is `ios` or `android`) |
| `POST /api/payments/app-store/complete-subscription` / `google-play/complete-subscription` | iOS / Android store purchase of `nwx_pro_radio_monthly` |
| `GET /api/pro-radio-subscription/access` | `hasAccess`, `status`, `currentPeriodEnd`, `betaFree` |

Gated endpoints return a 403 with `code: PRO_RADIO_SUBSCRIPTION_REQUIRED` and the intro pricing payload.

## Env

| Variable | Where | Notes |
| -------- | ----- | ----- |
| `STRIPE_PRO_RADIO_PRICE_ID`        | Backend | Regular monthly price         |
| `STRIPE_PRO_RADIO_INTRO_COUPON_ID` | Backend | First-month amount-off coupon |
| `BETA_ALL_FREE`                    | Backend | Defaults to `false`. `true` gives every user access. |

## Database

`pro_radio_subscriptions` (one row per user), migration `119_pro_radio_subscriptions.sql`.

## Checklist

- [ ] Price is $4.99/mo
- [ ] Intro coupon is $3 off once → $1.99 first invoice
- [ ] Second-time subscriber does not receive intro coupon on checkout.
- [ ] Mobile paywall buys `nwx_pro_radio_monthly` through the store, and **Restore purchases** works.
