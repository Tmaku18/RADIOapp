// Supabase Edge Function: Stripe webhook relay (optional edge entry point).
// Primary webhook remains Next.js /api/payments/webhook when STRANGLER_LOCAL includes payments.

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  const body = await req.arrayBuffer();
  const monolithUrl = Deno.env.get('MONOLITH_WEBHOOK_URL');

  if (!monolithUrl) {
    return new Response(JSON.stringify({ error: 'MONOLITH_WEBHOOK_URL not set' }), {
      status: 500,
    });
  }

  const res = await fetch(monolithUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'stripe-signature': signature } : {}),
    },
    body,
  });

  const text = await res.text();
  return new Response(text, { status: res.status });
});
