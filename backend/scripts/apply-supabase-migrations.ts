/**
 * Apply pending SQL migrations from backend/supabase/migrations.
 *
 * Usage (from repo root):
 *   npx ts-node backend/scripts/apply-supabase-migrations.ts
 *
 * Env (first match wins):
 *   DATABASE_URL — direct Postgres connection (preferred for DDL)
 *   web/.env.local — SUPABASE_URL + SUPABASE_SERVICE_KEY (data migration fallback for 091)
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'backend', 'supabase', 'migrations');

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function migrationName(file: string): string {
  return file.replace(/\.sql$/, '');
}

async function getAppliedMigrations(pg: PgClient): Promise<Set<string>> {
  await pg.query('CREATE SCHEMA IF NOT EXISTS supabase_migrations');
  await pg.query(`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      name text,
      statements text[],
      applied_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  const res = await pg.query(
    'SELECT version FROM supabase_migrations.schema_migrations',
  );
  return new Set(res.rows.map((r) => r.version as string));
}

async function applyWithPg(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return false;

  const pg = new PgClient({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pg.connect();

  try {
    const files = listMigrationFiles();
    const applied = await getAppliedMigrations(pg);
    let ran = 0;

    for (const file of files) {
      const version = migrationName(file);
      if (applied.has(version)) {
        console.log(`skip ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`apply ${file}...`);
      await pg.query('BEGIN');
      try {
        await pg.query(sql);
        await pg.query(
          `INSERT INTO supabase_migrations.schema_migrations (version, name)
           VALUES ($1, $2)`,
          [version, version],
        );
        await pg.query('COMMIT');
        ran++;
        console.log(`ok ${file}`);
      } catch (err) {
        await pg.query('ROLLBACK');
        throw err;
      }
    }

    console.log(ran ? `Applied ${ran} migration(s) via DATABASE_URL.` : 'No pending migrations.');
    return true;
  } finally {
    await pg.end();
  }
}

async function applyReadyNowCatalogViaApi(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'Set DATABASE_URL for full migrations, or SUPABASE_URL + SUPABASE_SERVICE_KEY for catalog sync.',
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, station_id, station_ids')
    .or('station_id.eq.us-rap,station_ids.cs.{us-rap}');

  if (error) throw new Error(`Failed to load songs: ${error.message}`);
  if (!songs?.length) {
    console.log('Ready Now catalog: no songs on us-rap (already migrated).');
    return;
  }

  let updated = 0;
  for (const song of songs) {
    const baseIds = Array.isArray(song.station_ids)
      ? [...song.station_ids]
      : song.station_id
        ? [song.station_id]
        : [];
    let newIds = baseIds.includes('us-ready-now-rap')
      ? baseIds
      : [...baseIds, 'us-ready-now-rap'];
    newIds = newIds.filter((id) => id !== 'us-rap');
    const newStationId =
      song.station_id === 'us-rap'
        ? newIds.includes('us-ready-now-rap')
          ? 'us-ready-now-rap'
          : (newIds[0] ?? 'us-ready-now-rap')
        : song.station_id;

    const { error: updateError } = await supabase
      .from('songs')
      .update({
        station_ids: newIds,
        station_id: newStationId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', song.id);
    if (updateError) {
      throw new Error(`Failed to update song ${song.id}: ${updateError.message}`);
    }
    updated++;
  }
  console.log(`Ready Now catalog: updated ${updated} song(s) via Supabase API.`);
}

async function verifyCatalog(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) return;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [onRap, onReady] = await Promise.all([
    supabase
      .from('songs')
      .select('id', { count: 'exact', head: true })
      .or('station_id.eq.us-rap,station_ids.cs.{us-rap}'),
    supabase
      .from('songs')
      .select('id', { count: 'exact', head: true })
      .or('station_id.eq.us-ready-now-rap,station_ids.cs.{us-ready-now-rap}'),
  ]);

  console.log(
    `Verify: us-rap=${onRap.count ?? 0} songs, us-ready-now-rap=${onReady.count ?? 0} songs`,
  );
}

async function main(): Promise<void> {
  loadEnvFile(path.join(REPO_ROOT, 'backend', '.env'));
  loadEnvFile(path.join(REPO_ROOT, 'web', '.env.local'));

  const usedPg = await applyWithPg();
  if (!usedPg) {
    console.log('DATABASE_URL not set — applying Ready Now catalog via Supabase API only.');
    await applyReadyNowCatalogViaApi();
  }
  await verifyCatalog();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
