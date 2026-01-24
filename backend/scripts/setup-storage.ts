/**
 * Setup script to create Supabase storage buckets for the RadioApp
 * Run with: npx ts-node scripts/setup-storage.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createBucket(name: string, isPublic: boolean = true) {
  console.log(`Creating bucket: ${name}...`);
  
  const { data, error } = await supabase.storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: name === 'songs' ? 52428800 : 5242880, // 50MB for songs, 5MB for others
    allowedMimeTypes: name === 'songs' 
      ? ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav']
      : ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log(`  ✓ Bucket "${name}" already exists`);
      return true;
    }
    console.error(`  ❌ Error creating bucket "${name}":`, error.message);
    return false;
  }

  console.log(`  ✓ Bucket "${name}" created successfully`);
  return true;
}

async function setupStorage() {
  console.log('\n🚀 Setting up Supabase Storage for RadioApp\n');
  console.log(`Supabase URL: ${supabaseUrl}\n`);

  // Create buckets
  const buckets = [
    { name: 'songs', description: 'Audio files (MP3, WAV) - max 50MB' },
    { name: 'artwork', description: 'Album artwork (JPEG, PNG, WebP) - max 5MB' },
  ];

  let allSuccess = true;
  for (const bucket of buckets) {
    console.log(`\n📦 ${bucket.description}`);
    const success = await createBucket(bucket.name);
    if (!success) allSuccess = false;
  }

  // List all buckets
  console.log('\n📋 Listing all buckets...');
  const { data: allBuckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('Error listing buckets:', listError.message);
  } else {
    console.log('\nExisting buckets:');
    allBuckets?.forEach(b => {
      console.log(`  - ${b.name} (public: ${b.public})`);
    });
  }

  console.log('\n' + (allSuccess ? '✅ Storage setup complete!' : '⚠️ Some buckets failed to create'));
  
  if (allSuccess) {
    console.log('\nYour storage buckets are ready:');
    console.log(`  Songs:   ${supabaseUrl}/storage/v1/object/public/songs/`);
    console.log(`  Artwork: ${supabaseUrl}/storage/v1/object/public/artwork/`);
  }
}

setupStorage().catch(console.error);
