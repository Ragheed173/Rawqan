import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';

// These exercise middleware/routing that runs BEFORE any DB access:
// health, 404 envelope, body-parser errors, auth guards, request validation.
let app: Express;
beforeAll(() => {
  app = createApp();
});

describe('health & 404', () => {
  it('GET /health → 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /ready → 200 only when PostgreSQL is reachable', async () => {
    const readyApp = createApp({
      readinessCheck: async () => ({ latencyMs: 7 }),
    });
    const res = await request(readyApp).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ready',
      checks: { database: { status: 'ok', latencyMs: 7 } },
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('GET /ready → 503 without leaking database errors', async () => {
    const unavailableApp = createApp({
      readinessCheck: async () => {
        throw new Error('postgresql://secret@private-host/production');
      },
    });
    const res = await request(unavailableApp).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'unavailable',
      checks: { database: { status: 'error' } },
    });
    expect(JSON.stringify(res.body)).not.toContain('private-host');
  });

  it('unknown route → 404 error envelope', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('body parsing', () => {
  it('malformed JSON → 400 (not 500)', async () => {
    const res = await request(app)
      .post('/api/analytics/track')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('auth guards (RBAC)', () => {
  it('admin items without token → 401', async () => {
    const res = await request(app).get('/api/admin/items?archived=false');
    expect(res.status).toBe(401);
  });

  it('admin analytics without token → 401', async () => {
    expect((await request(app).get('/api/admin/analytics')).status).toBe(401);
  });

  it('admin admins list without token → 401', async () => {
    expect((await request(app).get('/api/admin/admins')).status).toBe(401);
  });

  it('malformed Bearer token → 401', async () => {
    const res = await request(app).get('/api/admin/items').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });
});

describe('request validation', () => {
  it('login with missing password → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@rawaqan.local' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('login with invalid email → 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nope', password: 'x' });
    expect(res.status).toBe(400);
  });
});
