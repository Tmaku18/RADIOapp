const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
const supabase = createClient(backendEnv.SUPABASE_URL, backendEnv.SUPABASE_SERVICE_KEY);

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

const request = async ({ method, url, token, body, headers }) => {
  const requestHeaders = { 'Content-Type': 'application/json', ...(headers || {}) };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  console.log('Signing in test accounts...');
  const listenerToken = await signIn('listener.test@radioapp.local', 'RadioAppTest!123');
  const artistToken = await signIn('artist.test@radioapp.local', 'RadioAppTest!123');

  console.log('Auth required check (users/me without token)');
  const noAuth = await request({ method: 'GET', url: '/api/users/me' });
  assert(noAuth.status === 401, 'Expected 401 for unauthenticated users/me');

  console.log('Role guard check (admin endpoint with listener token)');
  const adminRes = await request({
    method: 'GET',
    url: '/api/admin/songs',
    token: listenerToken,
  });
  assert(adminRes.status === 403 || adminRes.status === 401, 'Expected role guard denial');

  console.log('Stripe webhook signature required check');
  const webhookRes = await request({
    method: 'POST',
    url: '/api/payments/webhook',
    body: {},
  });
  assert(webhookRes.status >= 400, 'Expected webhook to reject missing signature');

  console.log('Signed upload URL expiry check');
  const uploadRes = await request({
    method: 'POST',
    url: '/api/songs/upload-url',
    token: artistToken,
    body: { bucket: 'songs', filename: 'security.mp3', contentType: 'audio/mpeg' },
  });
  assert(uploadRes.status === 200 || uploadRes.status === 201, 'Upload URL request failed');
  assert(uploadRes.json?.expiresIn === 60, 'Expected signed URL expiry of 60 seconds');

  console.log('Shadow ban suppresses chat broadcast');
  const { data: listenerUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'listener.test@radioapp.local')
    .single();
  const listenerId = listenerUser?.id;
  assert(listenerId, 'Listener user not found in Supabase');

  const shadowUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await supabase
    .from('users')
    .update({ is_shadow_banned: true, shadow_banned_until: shadowUntil })
    .eq('id', listenerId);

  const shadowMessage = `Shadow ban test ${Date.now()}`;
  const shadowRes = await request({
    method: 'POST',
    url: '/api/chat/send',
    token: listenerToken,
    body: { message: shadowMessage, songId: null },
  });
  assert(shadowRes.status === 200 || shadowRes.status === 201, 'Shadow ban send failed');

  const { data: shadowRows } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('user_id', listenerId)
    .eq('message', shadowMessage);
  assert(!shadowRows || shadowRows.length === 0, 'Shadow banned message should not be stored');

  await supabase
    .from('users')
    .update({ is_shadow_banned: false, shadow_banned_until: null })
    .eq('id', listenerId);

  console.log('Rate limit check (burst messages)');
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const msg1 = await request({
    method: 'POST',
    url: '/api/chat/send',
    token: listenerToken,
    body: { message: `Rate test 1 ${Date.now()}`, songId: null },
  });
  const msg2 = await request({
    method: 'POST',
    url: '/api/chat/send',
    token: listenerToken,
    body: { message: `Rate test 2 ${Date.now()}`, songId: null },
  });
  assert(msg1.status === 200 || msg1.status === 201, 'First rate-limit message failed');
  assert(msg2.status >= 400, 'Expected second message to be rate-limited');

  console.log('Security checks completed.');
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
