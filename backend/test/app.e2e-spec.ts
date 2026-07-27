import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';

describe('App health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/app/version is public', async () => {
    const res = await request(app.getHttpServer()).get('/api/app/version');
    expect(res.status).not.toBe(401);
  });

  it('GET /api/users/me without auth returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/users/me with test auth is not 401/403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('x-test-uid', 'user-1')
      .set('x-test-role', 'listener');
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
