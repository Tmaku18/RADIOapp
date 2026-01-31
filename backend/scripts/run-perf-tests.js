const fs = require('fs');
const path = require('path');
const autocannon = require('autocannon');

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

const runAutocannon = (name, options) =>
  new Promise((resolve, reject) => {
    autocannon(options, (err, result) => {
      if (err) return reject(err);
      console.log(`${name} summary:`);
      console.log(`  Requests/sec: ${result.requests.average}`);
      console.log(`  Latency avg (ms): ${result.latency.average}`);
      console.log(`  Latency p99 (ms): ${result.latency.p99}`);
      resolve(result);
    });
  });

const run = async () => {
  console.log('Running perf tests (scaled-down)...');
  const listenerToken = await signIn('listener.test@radioapp.local', 'RadioAppTest!123');

  await runAutocannon('radio-current', {
    url: `${BASE_URL}/api/radio/current`,
    connections: 50,
    duration: 10,
  });

  await runAutocannon('chat-status', {
    url: `${BASE_URL}/api/chat/status`,
    connections: 30,
    duration: 10,
    headers: { Authorization: `Bearer ${listenerToken}` },
  });

  await runAutocannon('chat-send', {
    url: `${BASE_URL}/api/chat/send`,
    connections: 10,
    duration: 10,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${listenerToken}`,
    },
    body: JSON.stringify({ message: 'perf test message', songId: null }),
  });
};

run()
  .then(() => console.log('Perf tests completed.'))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
