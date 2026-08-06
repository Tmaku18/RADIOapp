# Pro-Radio Stripe Runbook

This runbook covers Stripe configuration for the Pro-Radio subscription ($9.99 /
month with a $4.99 promotional first month). Pro-Radio is **on-demand** listening
and playlists — it does not change live Networks Radio rotation or sync.

## Pricing model

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| Regular price    | $9.99 USD / month                        |
| Intro price      | $4.99 USD (first invoice only, one-time) |
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

- Price: `9.99` USD, monthly
- Copy `price_xxx` → `STRIPE_PRO_RADIO_PRICE_ID`

### 3. Intro coupon

- Name: `Pro-Radio First Month`
- Type: **Amount off** — `5.00` USD (9.99 − 5.00 = 4.99 first invoice)
- Duration: **Once**
- Copy coupon id → `STRIPE_PRO_RADIO_INTRO_COUPON_ID`

### 4. Webhook endpoint

Same endpoint as other subscriptions: `POST https://<api-host>/payments/webhook`

Events (shared handler):

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `setup_intent.succeeded`
- `invoice.paid`
- `invoice.payment_failed`

## Environment variables

| Variable                           | Where   | Notes                         |
| ---------------------------------- | ------- | ----------------------------- |
| `STRIPE_SECRET_KEY`                | Backend | Test/live secret              |
| `STRIPE_WEBHOOK_SECRET`            | Backend | Signing secret                |
| `STRIPE_PRO_RADIO_PRICE_ID`        | Backend | Regular monthly price         |
| `STRIPE_PRO_RADIO_INTRO_COUPON_ID` | Backend | First-month amount-off coupon |

See also `backend/.env.example`. Mobile uses IAP only — no Stripe keys on device.

## Application flow

### Web (Stripe Checkout)

1. User clicks **Subscribe** on `ProRadioPaywallCard` or `/pro-radio`.
2. Web calls `POST /payments/create-pro-radio-checkout-session` with `successUrl`
   / `cancelUrl` (default success: `/pro-radio?pro_radio=success`).
3. Backend applies intro coupon when `hasNeverSubscribed(userId)`.
4. Webhook `checkout.session.completed` → `PaymentsService.handleProRadioCheckoutCompleted`
   → `ProRadioSubscriptionService.setSubscription`.

### Mobile (store IAP)

1. `ProRadioPaywallSheet` → `nwx_pro_radio_monthly` via Play Billing / StoreKit.
2. Backend: `POST /payments/app-store/complete-subscription` or
   `POST /payments/google-play/complete-subscription` with product id
   `nwx_pro_radio_monthly`.

## What subscription unlocks

- Full-stream playback for songs with `opt_in_pro_radio = true` (when not owned).
- User playlists API (`/playlists/*`) gated by active Pro-Radio access.
- Live radio playback and rotation are unchanged.

## Quick verification

- [ ] Web checkout from `/pro-radio` returns with `pro_radio=success` and
      `GET /pro-radio-subscription/access` shows `hasAccess: true`.
- [ ] Artist profile / library play uses `/songs/:id/stream` into Pro-Radio queue
      when entitled; paywall when eligible but not subscribed.
- [ ] Stripe cancel fires `customer.subscription.deleted` and access clears.
- [ ] Second-time subscriber does not receive intro coupon on checkout.

## Local testing

```
stripe listen --forward-to localhost:3001/payments/webhook
```

Replay if needed:

```
stripe events resend evt_xxx
```

## Database

- `pro_radio_subscriptions` — migration `119_pro_radio_subscriptions.sql`
- `user_playlists` / `user_playlist_tracks` — migration `121_user_playlists.sql`
