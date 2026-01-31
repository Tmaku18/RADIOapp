const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

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

const supabaseUrl = backendEnv.SUPABASE_URL;
const supabaseKey = backendEnv.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env');
}

const supabase = createClient(supabaseUrl, supabaseKey);
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

const request = async (url, options = {}) => {
  const res = await fetch(`${BASE_URL}${url}`, options);
  const json = await res.json();
  return { status: res.status, json };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  const { data: fallbackSongs } = await supabase
    .from('admin_fallback_songs')
    .select('id, is_active');

  const { data: songs } = await supabase
    .from('songs')
    .select('id, title')
    .in('title', ['Test Credited Song', 'Test Trial Song', 'Test Opt-In Song']);

  const songIds = songs?.map((s) => s.id) || [];
  const fallbackIds = fallbackSongs?.map((s) => s.id) || [];

  console.log(`Seed songs found: ${songIds.length}`);
  console.log(`Fallback songs found: ${fallbackIds.length}`);

  console.log('Testing radio current (content available)...');
  const available = await request('/api/radio/current');
  assert(available.status === 200, 'Radio current should respond 200');
  if (!(available.json.no_content === false || available.json.id)) {
    console.error('  Response:', JSON.stringify(available.json));
    throw new Error('Expected playable track');
  }
  console.log('✓ Radio current returns playable content');

  console.log('Forcing no-content scenario...');
  if (!FIREBASE_API_KEY) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY in web/.env.local');
  }
  const adminToken = await signIn('admin.test@radioapp.local', 'RadioAppTest!123');
  await request('/api/radio/queue', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const redisUrl = backendEnv.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl);
  await redis.del(
    'radio:free_rotation_stack',
    'radio:current',
    'radio:playlist_type',
    'radio:fallback_position',
    'radio:songs_since_checkpoint',
  );
  await redis.quit();
  if (songIds.length) {
    await supabase
      .from('songs')
      .update({
        credits_remaining: 0,
        trial_plays_remaining: 0,
        opt_in_free_play: false,
      })
      .in('id', songIds);
  }
  if (fallbackIds.length) {
    await supabase.from('admin_fallback_songs').update({ is_active: false }).in('id', fallbackIds);
  }

  const noContent = await request('/api/radio/current');
  assert(noContent.status === 200, 'Radio current should respond 200');
  assert(noContent.json.no_content === true, 'Expected no_content true');
  console.log('✓ No-content response returned when fallback disabled');

  console.log('Restoring seed data...');
  if (fallbackIds.length) {
    await supabase.from('admin_fallback_songs').update({ is_active: true }).in('id', fallbackIds);
  }
  if (songIds.length) {
    await supabase
      .from('songs')
      .update({
        credits_remaining: 100,
        trial_plays_remaining: 3,
        opt_in_free_play: true,
      })
      .in('id', songIds);
  }
};

run()
  .then(() => console.log('Radio logic smoke checks completed.'))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
