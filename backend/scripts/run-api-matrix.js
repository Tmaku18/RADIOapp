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
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  console.log('Signing in test accounts...');
  const listenerToken = await signIn('listener.test@radioapp.local', 'RadioAppTest!123');
  const artistToken = await signIn('artist.test@radioapp.local', 'RadioAppTest!123');
  const adminToken = await signIn('admin.test@radioapp.local', 'RadioAppTest!123');

  const tests = [
    {
      name: 'Auth verify',
      method: 'GET',
      url: '/api/auth/verify',
      token: listenerToken,
      expect: (res) => res.status === 200,
    },
    {
      name: 'Get current user',
      method: 'GET',
      url: '/api/users/me',
      token: listenerToken,
      expect: (res) => res.status === 200 && res.json?.email,
    },
    {
      name: 'List songs',
      method: 'GET',
      url: '/api/songs',
      token: listenerToken,
      expect: (res) => res.status === 200 && Array.isArray(res.json),
    },
    {
      name: 'Radio current',
      method: 'GET',
      url: '/api/radio/current',
      token: null,
      expect: (res) =>
        res.status === 200 &&
        (typeof res.json?.no_content === 'boolean' || Boolean(res.json?.id)),
    },
    {
      name: 'Artist credits balance',
      method: 'GET',
      url: '/api/credits/balance',
      token: artistToken,
      expect: (res) => res.status === 200 && typeof res.json?.balance === 'number',
    },
    {
      name: 'Admin song list',
      method: 'GET',
      url: '/api/admin/songs',
      token: adminToken,
      expect: (res) => res.status === 200 && Array.isArray(res.json?.songs),
    },
    {
      name: 'Chat status',
      method: 'GET',
      url: '/api/chat/status',
      token: listenerToken,
      expect: (res) => res.status === 200 && typeof res.json?.enabled === 'boolean',
    },
    {
      name: 'Send chat message',
      method: 'POST',
      url: '/api/chat/send',
      token: listenerToken,
      body: { message: 'API matrix test message', songId: null },
      expect: (res) => res.status === 200 || res.status === 201,
    },
    {
      name: 'Notifications list',
      method: 'GET',
      url: '/api/notifications',
      token: artistToken,
      expect: (res) => res.status === 200 && Array.isArray(res.json?.notifications),
    },
  ];

  for (const test of tests) {
    const res = await request(test);
    try {
      assert(test.expect(res), `${test.name} failed (status ${res.status})`);
      console.log(`✓ ${test.name}`);
    } catch (error) {
      console.error(`✗ ${test.name}: ${error.message}`);
      if (res.json) {
        console.error('  Response:', JSON.stringify(res.json));
      }
      process.exitCode = 1;
    }
  }

  if (process.exitCode === 1) {
    throw new Error('API matrix tests failed');
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
