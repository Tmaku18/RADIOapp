import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

type TestAccount = {
  email: string;
  password: string;
  displayName: string;
  role: 'listener' | 'artist' | 'admin';
};

const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: 'listener.test@radioapp.local',
    password: 'RadioAppTest!123',
    displayName: 'Test Listener',
    role: 'listener',
  },
  {
    email: 'artist.test@radioapp.local',
    password: 'RadioAppTest!123',
    displayName: 'Test Artist',
    role: 'artist',
  },
  {
    email: 'admin.test@radioapp.local',
    password: 'RadioAppTest!123',
    displayName: 'Test Admin',
    role: 'admin',
  },
];

const SAMPLE_AUDIO_URL =
  'https://file-examples.com/storage/fe1e9f2b9b0e6f64f86/2017/11/file_example_MP3_700KB.mp3';
const SAMPLE_ARTWORK_URL = 'https://picsum.photos/400/400';

const loadEnv = () => {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env at ${envPath}.`);
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .forEach((line) => {
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) return;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
};

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const initFirebase = () => {
  const projectId = requireEnv('FIREBASE_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
};

const initSupabase = (): any => {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_SERVICE_KEY');
  return createClient(supabaseUrl, supabaseKey) as any;
};

const ensureFirebaseUser = async (
  auth: ReturnType<typeof getAuth>,
  account: TestAccount,
) => {
  try {
    const existing = await auth.getUserByEmail(account.email);
    return existing;
  } catch {
    return auth.createUser({
      email: account.email,
      password: account.password,
      displayName: account.displayName,
      emailVerified: true,
    });
  }
};

const ensureSupabaseUser = async (
  supabase: any,
  firebaseUid: string,
  account: TestAccount,
) => {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('users')
    .insert({
      firebase_uid: firebaseUid,
      email: account.email,
      display_name: account.displayName,
      role: account.role,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert user ${account.email}: ${error.message}`);
  }

  return data;
};

const ensureArtistCredits = async (supabase: any, artistId: string) => {
  const { data } = await supabase
    .from('credits')
    .select('id')
    .eq('artist_id', artistId)
    .single();

  if (data) return;

  const { error } = await supabase.from('credits').insert({
    artist_id: artistId,
    balance: 500,
    total_purchased: 500,
    total_used: 0,
  });

  if (error) {
    throw new Error(`Failed to create credits: ${error.message}`);
  }
};

const ensureSong = async (supabase: any, artistId: string, payload: Record<string, unknown>) => {
  const { data: existing } = await supabase
    .from('songs')
    .select('id')
    .eq('artist_id', artistId)
    .eq('title', payload.title as string)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('songs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert song ${payload.title}: ${error.message}`);
  }

  return data;
};

const ensureFallbackSong = async (supabase: any, payload: Record<string, unknown>) => {
  const { data: existing } = await supabase
    .from('admin_fallback_songs')
    .select('id')
    .eq('title', payload.title as string)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('admin_fallback_songs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert fallback song ${payload.title}: ${error.message}`);
  }

  return data;
};

const ensureChatConfig = async (supabase: any) => {
  const { error } = await supabase.from('chat_config').upsert({
    id: 'global',
    enabled: true,
    disabled_reason: null,
  });

  if (error) {
    throw new Error(`Failed to upsert chat_config: ${error.message}`);
  }
};

const ensureChatMessage = async (supabase: any, payload: Record<string, unknown>) => {
  const { data: existing } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('user_id', payload.user_id as string)
    .eq('message', payload.message as string)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert chat message: ${error.message}`);
  }

  return data;
};

const ensureNotification = async (supabase: any, payload: Record<string, unknown>) => {
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', payload.user_id as string)
    .eq('title', payload.title as string)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert notification: ${error.message}`);
  }

  return data;
};

const run = async () => {
  loadEnv();

  const firebaseApp = initFirebase();
  const auth = getAuth(firebaseApp);
  const supabase = initSupabase();

  const createdUsers: Record<string, any> = {};

  for (const account of TEST_ACCOUNTS) {
    const firebaseUser = await ensureFirebaseUser(auth, account);
    const supabaseUser = await ensureSupabaseUser(supabase, firebaseUser.uid, account);
    createdUsers[account.role] = supabaseUser;

    if (account.role === 'artist') {
      await ensureArtistCredits(supabase, supabaseUser.id);
    }
  }

  const artistId = createdUsers.artist.id as string;

  await ensureSong(supabase, artistId, {
    artist_id: artistId,
    title: 'Test Credited Song',
    artist_name: 'Test Artist',
    audio_url: SAMPLE_AUDIO_URL,
    artwork_url: SAMPLE_ARTWORK_URL,
    duration_seconds: 180,
    status: 'approved',
    credits_remaining: 100,
    trial_plays_remaining: 0,
    trial_plays_used: 0,
    opt_in_free_play: false,
  });

  await ensureSong(supabase, artistId, {
    artist_id: artistId,
    title: 'Test Trial Song',
    artist_name: 'Test Artist',
    audio_url: SAMPLE_AUDIO_URL,
    artwork_url: SAMPLE_ARTWORK_URL,
    duration_seconds: 180,
    status: 'approved',
    credits_remaining: 0,
    trial_plays_remaining: 3,
    trial_plays_used: 0,
    opt_in_free_play: false,
  });

  await ensureSong(supabase, artistId, {
    artist_id: artistId,
    title: 'Test Opt-In Song',
    artist_name: 'Test Artist',
    audio_url: SAMPLE_AUDIO_URL,
    artwork_url: SAMPLE_ARTWORK_URL,
    duration_seconds: 180,
    status: 'approved',
    credits_remaining: 0,
    trial_plays_remaining: 0,
    trial_plays_used: 0,
    opt_in_free_play: true,
  });

  await ensureSong(supabase, artistId, {
    artist_id: artistId,
    title: 'Test Pending Song',
    artist_name: 'Test Artist',
    audio_url: SAMPLE_AUDIO_URL,
    artwork_url: SAMPLE_ARTWORK_URL,
    duration_seconds: 180,
    status: 'pending',
  });

  await Promise.all([
    ensureFallbackSong(supabase, {
      title: 'Fallback Track 1',
      artist_name: 'Fallback Artist',
      audio_url: SAMPLE_AUDIO_URL,
      artwork_url: SAMPLE_ARTWORK_URL,
      duration_seconds: 180,
      is_active: true,
    }),
    ensureFallbackSong(supabase, {
      title: 'Fallback Track 2',
      artist_name: 'Fallback Artist',
      audio_url: SAMPLE_AUDIO_URL,
      artwork_url: SAMPLE_ARTWORK_URL,
      duration_seconds: 180,
      is_active: true,
    }),
    ensureFallbackSong(supabase, {
      title: 'Fallback Track 3',
      artist_name: 'Fallback Artist',
      audio_url: SAMPLE_AUDIO_URL,
      artwork_url: SAMPLE_ARTWORK_URL,
      duration_seconds: 180,
      is_active: true,
    }),
  ]);

  await ensureChatConfig(supabase);

  const now = new Date();
  const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  await ensureChatMessage(supabase, {
    user_id: createdUsers.listener.id,
    display_name: 'Test Listener',
    avatar_url: null,
    message: 'Hello from the seeded listener!',
    created_at: now.toISOString(),
  });

  await ensureChatMessage(supabase, {
    user_id: createdUsers.listener.id,
    display_name: 'Test Listener',
    avatar_url: null,
    message: 'Old message for archival test.',
    created_at: oldTimestamp,
  });

  await ensureNotification(supabase, {
    user_id: createdUsers.artist.id,
    type: 'info',
    title: 'Seeded Notification',
    message: 'This notification was created by the seed script.',
    metadata: { source: 'seed-test-data' },
  });

  console.log('Seed data created/verified successfully.');
  console.log('Test accounts:');
  TEST_ACCOUNTS.forEach((account) => {
    console.log(`- ${account.role}: ${account.email} / ${account.password}`);
  });
};

run().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
