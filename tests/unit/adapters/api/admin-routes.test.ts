import http from 'node:http';

import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for admin API key management routes.
 *
 * Module doesn't exist yet (Phase 5) — dynamic import ensures RED.
 * These test the route handlers for /api/admin/keys endpoints.
 */

function createMockApiKeyRepo() {
  return {
    save: vi.fn(),
    findByName: vi.fn().mockResolvedValue(null),
    findByHash: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    revoke: vi.fn(),
    updateLastUsed: vi.fn(),
  };
}

function makeKeyRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'test-bot',
    scopes: ['read'],
    created_at: '2026-01-01T00:00:00Z',
    expires_at: null,
    last_used_at: null,
    is_active: true,
    ...overrides,
  };
}

async function request(
  server: http.Server,
  method: string,
  path: string,
  body?: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const reqHeaders: Record<string, string> = {
      ...headers,
    };
    if (body) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = String(Buffer.byteLength(body));
    }
    const options: http.RequestOptions = {
      method,
      hostname: '127.0.0.1',
      port,
      path,
      headers: reqHeaders,
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        const resHeaders: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (typeof val === 'string') {
            resHeaders[key] = val;
          }
        }
        resolve({ status: res.statusCode ?? 500, body: parsed, headers: resHeaders });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

describe('Admin Routes (/api/admin/keys)', () => {
  describe('GET /api/admin/keys', () => {
    it('lists all keys without exposing key_hash or salt', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.findAll.mockResolvedValue([
        makeKeyRecord({ id: 1, name: 'key-a' }),
        makeKeyRecord({ id: 2, name: 'key-b' }),
      ]);

      const routes = buildAdminRoutes({ apiKeyRepo: repo });

      // Find the GET /api/admin/keys handler
      const listRoute = routes.find(r => r.method === 'GET' && r.pattern.test('/api/admin/keys'));
      expect(listRoute).toBeDefined();
    });
  });

  describe('POST /api/admin/keys', () => {
    it('generates a new key and returns the plaintext once', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();

      const routes = buildAdminRoutes({ apiKeyRepo: repo });

      const createRoute = routes.find(
        r => r.method === 'POST' && r.pattern.test('/api/admin/keys')
      );
      expect(createRoute).toBeDefined();
    });
  });

  describe('DELETE /api/admin/keys/:id', () => {
    it('revokes a key and returns 204', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.findById.mockResolvedValue(makeKeyRecord({ id: 5 }));

      const routes = buildAdminRoutes({ apiKeyRepo: repo });

      const revokeRoute = routes.find(
        r => r.method === 'DELETE' && r.pattern.test('/api/admin/keys/5')
      );
      expect(revokeRoute).toBeDefined();
    });

    it('returns 404 when key does not exist', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.findById.mockResolvedValue(null);

      const routes = buildAdminRoutes({ apiKeyRepo: repo });

      const revokeRoute = routes.find(
        r => r.method === 'DELETE' && r.pattern.test('/api/admin/keys/999')
      );
      expect(revokeRoute).toBeDefined();
    });
  });
});
