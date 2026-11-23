# Pro-Networx Stripe Runbook

This runbook covers the end-to-end Stripe configuration required to operate the
Pro-Networx subscription ($9.99 / month with a $4.99 promotional first month)
on the web, plus how it lines up with App Store / Google Play billing on mobile.

## Pricing model

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| Regular price    | $9.99 USD / month                         |
| Intro price      | $4.99 USD (first invoice only, one-time)  |
| Billing interval | `month`, `interval_count = 1`             |
| Currency         | `usd`                                     |
| Trial            | None — discount is applied via coupon     |
| Store SKU        | `nwx_pro_networx_monthly`                 |

The discount applies **only to the first invoice** so renewals charge the full
$9.99/mo. Eligibility for the intro coupon is gated by
`ProNetworkSubscriptionService.hasNeverSubscribed(userId)` — once a user has had
any Pro-Networx subscription row (active, canceled, or expired) they are excluded.

The shared pricing constants are defined in:

- Web: `web/src/data/pro-networx-pricing.ts`
- Mobile: `mobile/lib/core/constants/pro_networx_pricing.dart`
- Backend: `backend/src/pro-network-subscription/pro-network-subscription.constants.ts`

Update all three together if pricing changes. Pro-Networx is also included in
the Pro Bundle ([pro-bundle-stripe.md](pro-bundle-stripe.md)).

## Stripe dashboard setup

Run these once per Stripe account (test + live) before deploying.

### 1. Product

- Stripe Dashboard → Products → **+ Add product**
- Name: `Pro-Networx Subscription`
- Description: `Direct messages, contact reveal, and creator tools on Pro-Networx.`
- Statement descriptor: `NETWORX PRO`

### 2. Recurring price (regular)

- Pricing model: **Standard pricing**
- Price: `9.99` USD
- Billing period: **Monthly**
- Save and copy the resulting price ID into `STRIPE_PRO_NETWORX_PRICE_ID`.

### 3. Intro coupon

- Stripe Dashboard → Products → **Coupons** → **+ New**
- Name: `Pro-Networx First Month`
- Type: **Amount off**
- Amount: `5.00` USD (so $9.99 − $5.00 = $4.99 first invoice)
- Duration: **Once**
- ID: leave Stripe-generated, then copy it into
  `STRIPE_PRO_NETWORX_INTRO_COUPON_ID`.

> Why amount-off instead of percent-off? Amount-off renders predictable
> "$4.99 first month" copy regardless of currency rounding. If you change the
> regular price, update the coupon amount accordingly.

### 4. Webhook endpoint

- Stripe Dashboard → Developers → Webhooks → **+ Add endpoint**
- URL: `https://<api-host>/api/payments/webhook`
- Events used by Pro-Networx (the endpoint is shared with every other Stripe product):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `setup_intent.succeeded`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

The handler in `backend/src/payments/payments.controller.ts` routes subscription
events by the subscription's price ID: `STRIPE_PRO_NETWORX_PRICE_ID` goes to the
Pro-Networx handlers.

## Environment variables

Set the following on Railway (backend).

| Variable                          | Where    | Notes                                         |
| --------------------------------- | -------- | --------------------------------------------- |
| `STRIPE_SECRET_KEY`               | Backend  | `sk_test_…` / `sk_live_…`                     |
| `STRIPE_PUBLISHABLE_KEY`          | Backend  | Returned to clients in the Payment Sheet payload |
| `STRIPE_WEBHOOK_SECRET`           | Backend  | From the webhook endpoint above               |
| `STRIPE_PRO_NETWORX_PRICE_ID`     | Backend  | From step 2                                   |
| `STRIPE_PRO_NETWORX_INTRO_COUPON_ID` | Backend | From step 3                                  |
| `PRO_NETWORX_MESSAGING_BETA_FREE` | Backend  | Defaults to `true` (DMs free). Set `false` to require a subscription for DMs. |
| `BETA_ALL_FREE`                   | Backend  | Defaults to `false`. `true` unlocks every subscription feature. |

## Application flow

### Web (Stripe Checkout)

1. User clicks **Subscribe** on `PaywallCard` (`web/src/components/pro-networx/PaywallCard.tsx`)
   or the locked contact card on a service or studio detail page.
2. Web calls `POST /api/payments/create-pro-networx-checkout-session` with
   `successUrl`, `cancelUrl` (defaults: `/pro-networx/home?pro_networx=success`
   and `/pro-networx?pro_networx=canceled` on `WEB_URL`).
3. Backend (`StripeService.createProNetworxCheckoutSession`) creates a
   subscription Checkout Session, applying the intro coupon when
   `hasNeverSubscribed(userId) === true`. The response includes
   `introCouponApplied`.
4. User completes checkout; Stripe fires `checkout.session.completed`.
5. Webhook handler matches the price ID, then calls
   `ProNetworkSubscriptionService.setSubscription(...)` (upsert on `user_id`) so
   `GET /api/pro-network-subscription/access` returns `hasAccess: true`.

### Mobile (App Store / Google Play)

On iOS and Android the paywall (`ProNetworkPaywallSheet`) sells
`nwx_pro_networx_monthly` (or `nwx_pro_bundle_monthly`) through the store:

1. `PlayBillingService.buySubscription(productId)`.
2. The app sends the receipt to `POST /api/payments/app-store/complete-subscription`
   (iOS) or `POST /api/payments/google-play/complete-subscription` (Android).
3. Renewals and cancellations arrive at `POST /api/payments/app-store/notifications`
   (App Store Server Notifications V2) and `POST /api/payments/google-play/rtdn`.
4. **Restore purchases** re-sends an existing store subscription.

The backend refuses Stripe for digital goods when `x-client-platform` is `ios` or
`android` (`backend/src/payments/store-billing-policy.ts`).

### Payment Sheet (non-store clients)

`POST /api/payments/create-pro-networx-payment-sheet` returns `customerId`,
`ephemeralKeySecret`, `setupIntentClientSecret`, `publishableKey`, `priceId`, and
`couponId`. After the sheet succeeds, Stripe fires `setup_intent.succeeded` with
`metadata.productKey = pro_networx_subscription`; the webhook creates the
subscription on the customer (with the intro coupon when eligible) and calls
`setSubscription(...)`.

### Cancellation

- `customer.subscription.updated` → `setSubscription(...)` with the mapped Stripe
  status and `current_period_end`. A subscription set to cancel at period end
  stays `active` until then.
- `customer.subscription.deleted` → status `canceled`; access ends.

### What the subscription unlocks

`getAccess()` returns `hasAccess` (active or trialing, and period not ended) and
`canMessage`. A subscription unlocks:

- Direct messages with any Pro-Networx user (free for everyone while
  `PRO_NETWORX_MESSAGING_BETA_FREE` is on).
- Viewing the `email`, `phone`, and `link` contact fields on
  `pro_service_listings`.
- Feed comments and other features gated on `hasAccess`.

Service detail responses include the `contact` object only when the
viewer is the owner **or** has access. Gated endpoints return a 403 with
`code: PRO_NETWORK_SUBSCRIPTION_REQUIRED` and the intro pricing payload.

## Operational tasks

### Refunding a first invoice

Refunds are issued from the Stripe Dashboard. After issuing the refund,
optionally cancel the subscription with `cancel_at_period_end = true` to let the
user retain access for the remainder of the period.

### Re-enabling intro pricing for a user

Stripe's "duration: once" coupon is consumed on the first invoice. To grant
another discounted month manually:

1. Stripe Dashboard → Customers → choose the customer.
2. Apply the `Pro-Networx First Month` coupon directly to their subscription
   (or attach a fresh "duration: once" coupon).
3. The next invoice picks it up; backend webhooks do not need to change.

> The application's `hasNeverSubscribed` gate intentionally does not reset, so
> the discount cannot be re-applied via the in-app flow.

### Forcing a webhook replay

```
stripe events resend evt_xxx
```

Useful when a deploy missed a webhook delivery; `setSubscription` upserts one
row per user, so replays are safe.

### Local testing

Forward test webhooks to your local backend (Nest listens on port 3000 with the
`/api` prefix):

```
stripe listen --forward-to localhost:3000/api/payments/webhook
```

Then trigger the relevant events:

```
stripe trigger checkout.session.completed
stripe trigger setup_intent.succeeded
stripe trigger customer.subscription.deleted
```

## Database surface

- `pro_network_subscriptions` (one row per user; latest wins). Migration
  `063_pro_network_subscriptions.sql`; store billing columns (`store`,
  `apple_original_transaction_id`, `google_purchase_token`, `google_order_id`,
  `store_product_id`) in `109_pro_network_store_billing.sql`.
- `pro_service_listings.contact_email|phone|link` — only ever returned to
  subscribers or the owner.

## Quick verification checklist

- [ ] Web `Subscribe` from `PaywallCard` reaches Checkout, returns to
      `successUrl`, and the next page render shows access unlocked.
- [ ] Mobile `ProNetworkPaywallSheet` buys through the App Store / Google Play
      and `GET /api/pro-network-subscription/access` returns `hasAccess: true`.
- [ ] Cancel from Stripe Dashboard fires `customer.subscription.deleted` and
      `hasAccess` returns to `false` (with `BETA_ALL_FREE` off).
- [ ] Service listing detail page hides `contact_*` fields for a viewer without
      access and reveals them for a subscriber.
- [ ] Second-time subscriber does not receive the intro coupon.
