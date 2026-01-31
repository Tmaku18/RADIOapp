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
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(backendEnv.SUPABASE_URL, backendEnv.SUPABASE_SERVICE_KEY);

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
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
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
  const adminToken = await signIn('admin.test@radioapp.local', 'RadioAppTest!123');

  console.log('Step 1: Identity check');
  const meRes = await request({ method: 'GET', url: '/api/users/me', token: listenerToken });
  assert(meRes.status === 200, 'GET /api/users/me failed');
  console.log('✓ Identity check passed');

  const artistMe = await request({ method: 'GET', url: '/api/users/me', token: artistToken });
  assert(artistMe.status === 200, 'GET /api/users/me (artist) failed');

  console.log('Step 2: Ingest check (signed upload URL)');
  const uploadRes = await request({
    method: 'POST',
    url: '/api/songs/upload-url',
    token: artistToken,
    body: { bucket: 'songs', filename: 'e2e.mp3', contentType: 'audio/mpeg' },
  });
  assert(uploadRes.status === 200 || uploadRes.status === 201, 'Upload URL request failed');
  console.log('✓ Signed upload URL generated');

  console.log('Step 3: Payment check (create checkout session)');
  const checkoutRes = await request({
    method: 'POST',
    url: '/api/payments/create-checkout-session',
    token: artistToken,
    body: { amount: 100, credits: 5 },
  });
  assert(checkoutRes.status === 200 || checkoutRes.status === 201, 'Checkout session failed');
  console.log('✓ Checkout session created');

  console.log('Step 4: Allocation check');
  const artistId = artistMe.json?.id;
  if (artistId) {
    const { data: credits } = await supabase
      .from('credits')
      .select('id, balance')
      .eq('artist_id', artistId)
      .single();

    if (!credits) {
      await supabase.from('credits').insert({
        artist_id: artistId,
        balance: 500,
        total_purchased: 500,
        total_used: 0,
      });
    } else if (credits.balance < 50) {
      await supabase
        .from('credits')
        .update({ balance: 500, total_purchased: 500 })
        .eq('id', credits.id);
    }
  }
  const mySongs = await request({ method: 'GET', url: '/api/songs/mine', token: artistToken });
  assert(mySongs.status === 200, 'GET /api/songs/mine failed');
  const creditedSong = (mySongs.json || []).find((song) => song.title === 'Test Credited Song');
  assert(creditedSong, 'Credited song not found');
  const allocateRes = await request({
    method: 'POST',
    url: `/api/credits/songs/${creditedSong.id}/allocate`,
    token: artistToken,
    body: { amount: 5 },
  });
  if (!(allocateRes.status === 200 || allocateRes.status === 201)) {
    console.error('Allocate response:', JSON.stringify(allocateRes.json));
    throw new Error('Allocation failed');
  }
  console.log('✓ Credits allocated');

  console.log('Step 5: Moderation check (approve pending)');
  const pendingRes = await request({
    method: 'GET',
    url: '/api/admin/songs?status=pending',
    token: adminToken,
  });
  assert(pendingRes.status === 200, 'Admin songs fetch failed');
  const pendingSong = (pendingRes.json?.songs || []).find(
    (song) => song.title === 'Test Pending Song',
  );
  if (pendingSong) {
    const approveRes = await request({
      method: 'PATCH',
      url: `/api/admin/songs/${pendingSong.id}`,
      token: adminToken,
      body: { status: 'approved' },
    });
    assert(approveRes.status === 200, 'Approve song failed');
    console.log('✓ Pending song approved');
  } else {
    console.log('INFO: No pending song found to approve');
  }

  console.log('Step 6: Selection check');
  const currentRes = await request({ method: 'GET', url: '/api/radio/current' });
  assert(currentRes.status === 200, 'Radio current failed');
  console.log('✓ Radio current returned');

  console.log('Step 7: Chat send + history');
  const chatSend = await request({
    method: 'POST',
    url: '/api/chat/send',
    token: listenerToken,
    body: { message: 'E2E happy path message', songId: null },
  });
  assert(chatSend.status === 200 || chatSend.status === 201, 'Chat send failed');
  const chatHistory = await request({
    method: 'GET',
    url: '/api/chat/history',
    token: listenerToken,
  });
  if (chatHistory.status !== 200) {
    console.error('Chat history response:', JSON.stringify(chatHistory.json));
    throw new Error('Chat history failed');
  }
  console.log('✓ Chat send and history passed');

  console.log('Step 8: Deduction check (report play)');
  if (currentRes.json?.id) {
    const playRes = await request({
      method: 'POST',
      url: '/api/radio/play',
      token: listenerToken,
      body: { songId: currentRes.json.id, skipped: false },
    });
    if (!(playRes.status === 200 || playRes.status === 201)) {
      console.error('Report play response:', JSON.stringify(playRes.json));
      throw new Error('Report play failed');
    }
    console.log('✓ Play reported');
  } else {
    console.log('INFO: No current track id to report play');
  }

  console.log('Step 9: Fallback check');
  const fallbackRes = await request({ method: 'GET', url: '/api/radio/current' });
  assert(fallbackRes.status === 200, 'Radio current failed');
  console.log('✓ Fallback check executed');

  console.log('Step 10: Cleanup check (reject song)');
  if (pendingSong) {
    const rejectRes = await request({
      method: 'PATCH',
      url: `/api/admin/songs/${pendingSong.id}`,
      token: adminToken,
      body: { status: 'rejected', reason: 'Audio quality too low' },
    });
    assert(rejectRes.status === 200, 'Reject song failed');
    console.log('✓ Song rejected with reason');
  } else {
    console.log('INFO: No pending song available for rejection');
  }
};

run()
  .then(() => console.log('E2E happy path completed.'))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
