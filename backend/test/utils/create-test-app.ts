import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createSupabaseMock } from '../../src/test-utils/supabase-mock';
import { createRedisMock } from '../../src/test-utils/mocks';

jest.mock('music-metadata', () => ({ parseBuffer: jest.fn() }), {
  virtual: true,
});

jest.mock('../../src/config/supabase.config', () => ({
  initializeSupabase: jest.fn(() => createSupabaseMock()),
  getSupabaseClient: jest.fn(() => createSupabaseMock()),
}));

jest.mock('../../src/config/firebase.config', () => ({
  initializeFirebase: jest.fn(),
  getFirebaseAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

jest.mock('../../src/config/redis.config', () => ({
  getRedisClient: jest.fn(() => createRedisMock()),
  isRedisAvailable: jest.fn(async () => false),
  initializeRedis: jest.fn(),
}));

jest.mock('../../src/auth/guards/firebase-auth.guard', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TestFirebaseAuthGuard } = require('./test-auth.guards');
  return { FirebaseAuthGuard: TestFirebaseAuthGuard };
});

jest.mock('../../src/auth/guards/roles.guard', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TestRolesGuard } = require('./test-auth.guards');
  return { RolesGuard: TestRolesGuard };
});

import { AppModule } from '../../src/app.module';

function ensureTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL =
    process.env.SUPABASE_URL || 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
  process.env.FIREBASE_PROJECT_ID =
    process.env.FIREBASE_PROJECT_ID || 'test-project';
  process.env.STRIPE_SECRET_KEY =
    process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
  process.env.REDIS_URL = process.env.REDIS_URL || '';
}

export async function createTestApp(): Promise<{
  app: INestApplication;
  moduleFixture: TestingModule;
}> {
  ensureTestEnv();

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({
    rawBody: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return { app, moduleFixture };
}
