const fs = require('fs');
const path = require('path');

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    });
  return env;
};

const backendEnv = loadEnvFile(path.resolve(__dirname, '..', '.env'));
const webEnv = loadEnvFile(path.resolve(__dirname, '..', '..', 'web', '.env.local'));

const BASE_URL = backendEnv.API_BASE_URL || 'http://localhost:3000';
const FIREBASE_API_KEY = webEnv.NEXT_PUBLIC_FIREBASE_API_KEY;

if (!FIREBASE_API_KEY) {
  throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY in web/.env.local');
}

const signIn = async (email, password) => {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to sign in ${email}: ${text}`);
  }
  const data = await res.json();
  return data.idToken;
};

const request = async ({ method, url, token, body }) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { status: res.status, json };
  } catch (error) {
    console.error('Request failed:', error?.message || error);
    if (error?.cause) {
      console.error('Cause:', error.cause);
    }
    throw error;
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  console.log('Signing in artist account...');
  const artistToken = await signIn('artist.test@radioapp.local', 'RadioAppTest!123');

  console.log('Testing signed upload URL...');
  const uploadRes = await request({
    method: 'POST',
    url: '/api/songs/upload-url',
    token: artistToken,
    body: {
      bucket: 'songs',
      filename: 'test.mp3',
      contentType: 'audio/mpeg',
    },
  });

  assert(uploadRes.status === 201 || uploadRes.status === 200, 'Upload URL request failed');
  assert(uploadRes.json?.signedUrl, 'Missing signedUrl in response');
  assert(uploadRes.json?.path, 'Missing path in response');
  console.log('✓ Signed upload URL generated');

  console.log('Testing create payment intent (Stripe)...');
  const intentRes = await request({
    method: 'POST',
    url: '/api/payments/create-intent',
    token: artistToken,
    body: { amount: 100, credits: 5 },
  });
  assert(intentRes.status === 201 || intentRes.status === 200, 'Payment intent request failed');
  assert(intentRes.json?.clientSecret, 'Missing clientSecret from payment intent');
  console.log('✓ Payment intent created');

  console.log('Testing checkout session (Stripe)...');
  const sessionRes = await request({
    method: 'POST',
    url: '/api/payments/create-checkout-session',
    token: artistToken,
    body: { amount: 100, credits: 5 },
  });
  assert(sessionRes.status === 201 || sessionRes.status === 200, 'Checkout session request failed');
  assert(sessionRes.json?.url, 'Missing checkout session URL');
  console.log('✓ Checkout session created');
};

run()
  .then(() => console.log('Integration checks completed.'))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
