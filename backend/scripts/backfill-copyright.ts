/* eslint-disable no-console */
/**
 * Fingerprint uploaded songs for copyright via ACRCloud.
 *
 * Usage (from backend/, with production env — prefer Railway):
 *   railway run --service backend -- npx ts-node -r tsconfig-paths/register scripts/backfill-copyright.ts --force
 *
 * Flags:
 *   --force   Re-scan the whole catalog (including clear/flagged)
 *   (default) Only pending / error / skipped / checking
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CopyrightService } from '../src/copyright/copyright.service';

async function main() {
  const force = process.argv.includes('--force');
  console.log(
    force
      ? 'Starting copyright backfill (FORCE: all songs with audio)...'
      : 'Starting copyright backfill (unscanned / failed only)...',
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const copyright = app.get(CopyrightService);
    const result = await copyright.backfillChecks({ force, wait: true });
    console.log(JSON.stringify(result, null, 2));
    if (result.alreadyRunning) {
      console.error('A copyright backfill is already running.');
      process.exitCode = 2;
      return;
    }
    if (result.queued === 0) {
      console.log('Nothing to scan.');
      return;
    }
    console.log(`Done. Scanned ${result.queued} song(s).`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Copyright backfill failed:', err);
  process.exit(1);
});
