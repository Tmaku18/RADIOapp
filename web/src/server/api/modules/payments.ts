import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

/**
 * Stripe webhook handler (ported from NestJS payments.controller webhook).
 * Requires raw body — called from route with arrayBuffer body.
 */
export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string | null,
): Promise<Response> {
  if (!signature) {
    return NextResponse.json({ message: 'Missing stripe-signature' }, { status: 400 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ message: 'Webhook secret not configured' }, { status: 500 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  // Delegate event processing to legacy backend until full port of payments.service.
  const backendUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (backendUrl && process.env.PAYMENTS_WEBHOOK_DELEGATE_LEGACY !== 'false') {
    const base = backendUrl.replace(/\/$/, '').replace(/\/api$/, '');
    const res = await fetch(`${base}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: new Uint8Array(rawBody),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Minimal local acknowledgment when legacy delegate disabled.
  return NextResponse.json({ received: true, type: event.type, strangler: 'local-payments' });
}

export async function paymentsHandler(
  request: NextRequest,
  pathSegments: string[],
): Promise<Response | null> {
  const sub = pathSegments.slice(1).join('/');
  if (request.method === 'POST' && sub === 'webhook') {
    const signature = request.headers.get('stripe-signature');
    const raw = Buffer.from(await request.arrayBuffer());
    return handleStripeWebhook(raw, signature);
  }
  return null;
}
