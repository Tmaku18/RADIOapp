import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { createTestApp } from './utils/create-test-app';

type RouteEntry = {
  method: string;
  path: string;
  public: boolean;
  roles: string[];
  handler: string;
};

const inventoryPath = path.join(__dirname, 'route-inventory.json');

function loadRoutes(): RouteEntry[] {
  const raw = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  return raw.routes as RouteEntry[];
}

/** Paths that are public webhooks / streaming — auth matrix only checks 401 vs not. */
function isWebhookOrSpecial(route: RouteEntry): boolean {
  const p = route.path.toLowerCase();
  return (
    p.includes('webhook') ||
    (p.includes('notifications') && p.includes('app-store')) ||
    p.includes('/rtdn') ||
    (p.includes('stripe') && route.method === 'POST')
  );
}

function pathForRequest(template: string): string {
  // Fill path params with dummy ids so Express can match.
  return template.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, 'test-id');
}

describe('API route auth matrix (e2e)', () => {
  let app: INestApplication;
  const routes = loadRoutes();

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('has a non-empty route inventory', () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  describe('unauthenticated access', () => {
    const samples = routes.filter((r) => !isWebhookOrSpecial(r));

    it.each(
      samples.map((r) => [`${r.method} ${r.path}`, r] as const),
    )('%s', async (_label, route) => {
      const url = pathForRequest(route.path);
      const req = request(app.getHttpServer())[route.method.toLowerCase()](url);
      const res = await req.send(route.method === 'GET' ? undefined : {});
      if (route.public) {
        expect(res.status).not.toBe(401);
      } else {
        expect(res.status).toBe(401);
      }
    });
  });

  describe('role-gated routes reject wrong role', () => {
    const gated = routes.filter(
      (r) => !r.public && r.roles.length > 0 && !isWebhookOrSpecial(r),
    );

    it.each(
      gated.map((r) => [`${r.method} ${r.path} roles=${r.roles.join(',')}`, r] as const),
    )('%s', async (_label, route) => {
      // Pick a role that should fail: listener cannot satisfy admin-only;
      // for artist-only use a role that isn't in the artist hierarchy — none,
      // so use a nonsense role.
      const wrongRole = route.roles.includes('admin')
        ? 'listener'
        : route.roles.includes('artist') ||
            route.roles.includes('service_provider') ||
            route.roles.includes('dj') ||
            route.roles.includes('musician')
          ? 'listener'
          : 'listener';

      // listener satisfies listener role — skip those
      if (route.roles.every((r) => r === 'listener')) {
        return;
      }
      // If artist is required, listener should 403
      if (
        !route.roles.includes('listener') &&
        (route.roles.includes('artist') ||
          route.roles.includes('admin') ||
          route.roles.includes('service_provider') ||
          route.roles.includes('dj') ||
          route.roles.includes('musician'))
      ) {
        const url = pathForRequest(route.path);
        const res = await request(app.getHttpServer())
          [route.method.toLowerCase()](url)
          .set('x-test-uid', 'user-listener')
          .set('x-test-role', wrongRole)
          .send(route.method === 'GET' ? undefined : {});
        expect(res.status).toBe(403);
      }
    });
  });

  describe('authenticated listener is past auth for non-role routes', () => {
    const openAuth = routes.filter(
      (r) =>
        !r.public &&
        r.roles.length === 0 &&
        r.method === 'GET' &&
        !isWebhookOrSpecial(r) &&
        !r.path.startsWith('/api/admin'),
    );

    it.each(
      openAuth.slice(0, 40).map((r) => [`${r.method} ${r.path}`, r] as const),
    )('%s', async (_label, route) => {
      const url = pathForRequest(route.path);
      const res = await request(app.getHttpServer())
        .get(url)
        .set('x-test-uid', 'user-1')
        .set('x-test-role', 'listener');
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});

