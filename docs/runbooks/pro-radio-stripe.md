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

Intro eligibility uses `ProRadioSubscriptionService.hasNeverSubscribed(userId)`.

Display constants (keep in sync):

- Web: `web/src/data/pro-radio-pricing.ts`
- Mobile: `mobile/lib/core/constants/pro_radio_pricing.dart`
- Backend: `backend/src/pro-radio-subscription/pro-radio-subscription.constants.ts`

## Stripe dashboard setup

### 1. Product

- Name: `Pro-Radio Subscription`
- Description: `On-demand full tracks and personal playlists on Networks Radio.`
- Statement descriptor: `NETWORX RADIO` (or your account default)

### 2. Recurring price (regular)

- Price: `4.99` USD, monthly
- Copy `price_xxx` → `STRIPE_PRO_RADIO_PRICE_ID`

### 3. Intro coupon

- Name: `Pro-Radio First Month`
- Type: **Amount off** — `3.00` USD (4.99 − 3.00 = 1.99 first invoice)
- Duration: **Once**
- Copy coupon id → `STRIPE_PRO_RADIO_INTRO_COUPON_ID`

### 4. Webhook endpoint

Same endpoint as other subscriptions: `POST https://<api-host>/payments/webhook`

Events (shared handler):

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `setup_intent.succeeded`

## Env

| Variable | Where | Notes |
| -------- | ----- | ----- |
| `STRIPE_PRO_RADIO_PRICE_ID`        | Backend | Regular monthly price         |
| `STRIPE_PRO_RADIO_INTRO_COUPON_ID` | Backend | First-month amount-off coupon |

## Checklist

- [ ] Price is $4.99/mo
- [ ] Intro coupon is $3 off once → $1.99 first invoice
- [ ] Second-time subscriber does not receive intro coupon on checkout.
