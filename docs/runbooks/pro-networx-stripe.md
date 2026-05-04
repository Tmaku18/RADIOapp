# Pro-Networx Stripe Runbook

This runbook covers the end-to-end Stripe configuration required to operate the
Pro-Networx subscription ($9.99 / month with a $4.99 promotional first month).

## Pricing model

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| Regular price    | $9.99 USD / month                         |
| Intro price      | $4.99 USD (first invoice only, one-time)  |
| Billing interval | `month`, `interval_count = 1`             |
| Currency         | `usd`                                     |
| Trial            | None — discount is applied via coupon     |

The discount applies **only to the first invoice** so renewals charge the full
$9.99/mo. Eligibility for the intro coupon is gated by
`ProNetworkSubscriptionService.hasNeverSubscribed(userId)` — once a user has had
any Pro-Networx subscription (active, canceled, or expired) they are excluded.

The shared display constants are defined in:

- Web: `web/src/data/pro-networx-pricing.ts`
- Mobile: `mobile/lib/core/constants/pro_networx_pricing.dart`

Update both files together if pricing changes.

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
- Save and copy the resulting `price_xxx` ID. This is `STRIPE_PRO_NETWORX_PRICE_ID`.

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
- URL: `https://<api-host>/payments/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `setup_intent.succeeded`
  - `invoice.paid`
  - `invoice.payment_failed`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Environment variables

Set the following on Railway (backend) and on Vercel (web preview/prod) where
applicable.

| Variable                          | Where    | Notes                              |
| --------------------------------- | -------- | ---------------------------------- |
| `STRIPE_SECRET_KEY`               | Backend  | `sk_test_…` / `sk_live_…`          |
| `STRIPE_PUBLISHABLE_KEY`          | Web/API  | `pk_test_…` / `pk_live_…`          |
| `STRIPE_WEBHOOK_SECRET`           | Backend  | From the webhook endpoint above    |
| `STRIPE_PRO_NETWORX_PRICE_ID`     | Backend  | From step 2                        |
| `STRIPE_PRO_NETWORX_INTRO_COUPON_ID` | Backend | From step 3                       |

The mobile Flutter app does not need these — it reads `publishableKey` and
`setupIntentClientSecret` from
`POST /payments/pro-networx/payment-sheet`.

## Application flow

### Web (Stripe Checkout)

1. User clicks **Subscribe** on `PaywallCard` /
   `ContactInfoLockedCard`.
2. Web calls `POST /payments/pro-networx/checkout` with `successUrl`,
   `cancelUrl`.
3. Backend (`StripeService.createProNetworxCheckoutSession`) creates a
   subscription Checkout Session, applying the intro coupon when
   `hasNeverSubscribed(userId) === true`.
4. User completes checkout; Stripe fires `checkout.session.completed`.
5. Webhook handler resolves the subscription, then calls
   `ProNetworkSubscriptionService.markActive(userId, …)` so subsequent calls to
   `getAccess()` return `subscribed: true`.

### Mobile (Payment Sheet)

1. User taps **Subscribe** in `ProNetworkPaywallSheet`.
2. Mobile calls `POST /payments/pro-networx/payment-sheet` and receives
   `customerId`, `ephemeralKeySecret`, `setupIntentClientSecret`,
   `publishableKey`.
3. Flutter calls `Stripe.instance.initPaymentSheet(...)` then
   `presentPaymentSheet()`.
4. On success Stripe fires `setup_intent.succeeded`.
5. Webhook handler creates the subscription server-side using the saved payment
   method (with `discounts: [{ coupon: STRIPE_PRO_NETWORX_INTRO_COUPON_ID }]`
   when eligible) and calls `markActive(...)`.

### Cancellation

- `customer.subscription.updated` with `cancel_at_period_end = true` →
  `markActive(...)` keeps the user subscribed until period end.
- `customer.subscription.deleted` → `markCanceled(userId)` removes access.

### What "subscription unlocks"

A single subscription unlocks **both** of the following — there is no separate
DM tier:

- Direct messages with any Pro-Networx user.
- Viewing the `email`, `phone`, and `link` contact fields on
  `pro_service_listings`.

Public service detail responses include the `contact` object only when the
viewer is the owner **or** has an active subscription.

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

Useful when a deploy missed a webhook delivery; the handler is idempotent on
`stripe_subscription_id`.

### Local testing

Forward live test webhooks to your local backend:

```
stripe listen --forward-to localhost:3001/payments/webhook
```

Then trigger the relevant events:

```
stripe trigger checkout.session.completed
stripe trigger setup_intent.succeeded
stripe trigger customer.subscription.deleted
```

## Database surface

- `pro_network_subscriptions` (one row per user; latest wins). Migration
  `065_pro_network_subscriptions.sql`.
- `pro_service_listings.contact_email|phone|link` — only ever returned to
  subscribers or the owner.

## Quick verification checklist

- [ ] Web `Subscribe` from `PaywallCard` reaches Checkout, returns to
      `successUrl`, and the next page render shows DMs unlocked.
- [ ] Mobile `ProNetworkPaywallSheet` opens Payment Sheet, completes, and
      `getAccess()` returns `subscribed: true`.
- [ ] Cancel from Stripe Dashboard fires `customer.subscription.deleted` and
      `getAccess()` returns to `subscribed: false`.
- [ ] Service listing detail page hides `contact_*` fields for an
      unsubscribed viewer and reveals them for a subscribed viewer.
- [ ] Second-time subscriber does not receive the intro coupon.
