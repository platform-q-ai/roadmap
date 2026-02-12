import http from 'node:http';
import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for admin API key management routes.
 * Tests route handlers via mock request/response objects.
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

function createMockRes(): {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  body: string;
  statusCode: number;
} {
  const res = {
    statusCode: 200,
    body: '',
    writeHead: vi.fn(function (this: { statusCode: number }, status: number) {
      this.statusCode = status;
    }),
    end: vi.fn(function (this: { body: string }, data?: string) {
      this.body = data ?? '';
    }),
  };
  return res;
}

function createMockReq(method: string, url: string, body?: string): http.IncomingMessage {
  const req = new Readable({ read() {} }) as unknown as http.IncomingMessage;
  Object.assign(req, { method, url, headers: {} });
  if (body) {
    process.nextTick(() => {
      (req as NodeJS.ReadableStream).emit('data', Buffer.from(body));
      (req as NodeJS.ReadableStream).emit('end');
    });
  } else {
    process.nextTick(() => {
      (req as NodeJS.ReadableStream).emit('end');
    });
  }
  return req;
}

describe('Admin Routes (/api/admin/keys)', () => {
  describe('GET /api/admin/keys', () => {
    it('returns all keys as JSON array', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.findAll.mockResolvedValue([]);
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const listRoute = routes.find(r => r.method === 'GET' && r.pattern.test('/api/admin/keys'));
      expect(listRoute).toBeDefined();

      const req = createMockReq('GET', '/api/admin/keys');
      const res = createMockRes();
      const match = '/api/admin/keys'.match(listRoute!.pattern)!;
      await listRoute!.handler(req, res as unknown as http.ServerResponse, match);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
      expect(JSON.parse(res.body)).toEqual([]);
    });
  });

  describe('POST /api/admin/keys', () => {
    it('creates a new key and returns 201 with plaintext', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const createRoute = routes.find(
        r => r.method === 'POST' && r.pattern.test('/api/admin/keys')
      );
      expect(createRoute).toBeDefined();

      const body = JSON.stringify({ name: 'test-bot', scopes: ['read'] });
      const req = createMockReq('POST', '/api/admin/keys', body);
      const res = createMockRes();
      const match = '/api/admin/keys'.match(createRoute!.pattern)!;
      await createRoute!.handler(req, res as unknown as http.ServerResponse, match);

      expect(res.writeHead).toHaveBeenCalledWith(201, expect.anything());
      const parsed = JSON.parse(res.body);
      expect(parsed.key).toMatch(/^rmap_/);
      expect(parsed.name).toBe('test-bot');
    });

    it('returns 400 for invalid JSON', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const createRoute = routes.find(
        r => r.method === 'POST' && r.pattern.test('/api/admin/keys')
      );

      const req = createMockReq('POST', '/api/admin/keys', 'not json');
      const res = createMockRes();
      await createRoute!.handler(
        req,
        res as unknown as http.ServerResponse,
        '/api/admin/keys'.match(createRoute!.pattern)!
      );

      expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    });

    it('returns 400 for missing name', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const createRoute = routes.find(
        r => r.method === 'POST' && r.pattern.test('/api/admin/keys')
      );

      const req = createMockReq('POST', '/api/admin/keys', JSON.stringify({ scopes: ['read'] }));
      const res = createMockRes();
      await createRoute!.handler(
        req,
        res as unknown as http.ServerResponse,
        '/api/admin/keys'.match(createRoute!.pattern)!
      );

      expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    });

    it('returns 400 for invalid scopes', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const createRoute = routes.find(
        r => r.method === 'POST' && r.pattern.test('/api/admin/keys')
      );

      const req = createMockReq(
        'POST',
        '/api/admin/keys',
        JSON.stringify({ name: 'x', scopes: ['invalid'] })
      );
      const res = createMockRes();
      await createRoute!.handler(
        req,
        res as unknown as http.ServerResponse,
        '/api/admin/keys'.match(createRoute!.pattern)!
      );

      expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
    });

    it('returns 409 when key name already exists', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.save.mockRejectedValue(new Error('Key already exists'));
      repo.findByName.mockResolvedValue({ id: 1, name: 'dup' });
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const createRoute = routes.find(
        r => r.method === 'POST' && r.pattern.test('/api/admin/keys')
      );

      const body = JSON.stringify({ name: 'dup', scopes: ['read'] });
      const req = createMockReq('POST', '/api/admin/keys', body);
      (req as unknown as Record<string, unknown>).requestId = 'test-id';
      const res = createMockRes();
      await createRoute!.handler(
        req,
        res as unknown as http.ServerResponse,
        '/api/admin/keys'.match(createRoute!.pattern)!
      );

      expect(res.writeHead).toHaveBeenCalledWith(409, expect.anything());
      const parsed = JSON.parse(res.body);
      expect(parsed.request_id).toBe('test-id');
    });
  });

  describe('DELETE /api/admin/keys/:id', () => {
    it('revokes a key by numeric id and returns 200', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.findById.mockResolvedValue({ id: 5, is_active: true });
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const revokeRoute = routes.find(
        r => r.method === 'DELETE' && r.pattern.test('/api/admin/keys/5')
      );

      const req = createMockReq('DELETE', '/api/admin/keys/5');
      const res = createMockRes();
      const match = '/api/admin/keys/5'.match(revokeRoute!.pattern)!;
      await revokeRoute!.handler(req, res as unknown as http.ServerResponse, match);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
      expect(repo.revoke).toHaveBeenCalledWith(5);
    });

    it('revokes a key by name lookup', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.findByName.mockResolvedValue({ id: 7, name: 'my-key', is_active: true });
      repo.findById.mockResolvedValue({ id: 7, name: 'my-key', is_active: true });
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const revokeRoute = routes.find(
        r => r.method === 'DELETE' && r.pattern.test('/api/admin/keys/my-key')
      );

      const req = createMockReq('DELETE', '/api/admin/keys/my-key');
      const res = createMockRes();
      const match = '/api/admin/keys/my-key'.match(revokeRoute!.pattern)!;
      await revokeRoute!.handler(req, res as unknown as http.ServerResponse, match);

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
      expect(repo.revoke).toHaveBeenCalledWith(7);
    });

    it('returns 404 when name-based lookup finds nothing', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.findByName.mockResolvedValue(null);
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const revokeRoute = routes.find(
        r => r.method === 'DELETE' && r.pattern.test('/api/admin/keys/no-such')
      );

      const req = createMockReq('DELETE', '/api/admin/keys/no-such');
      const res = createMockRes();
      const match = '/api/admin/keys/no-such'.match(revokeRoute!.pattern)!;
      await revokeRoute!.handler(req, res as unknown as http.ServerResponse, match);

      expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
    });

    it('returns 404 when numeric key does not exist', async () => {
      const { buildAdminRoutes } = await import('../../../../src/adapters/api/admin-routes.js');
      const repo = createMockApiKeyRepo();
      repo.findById.mockResolvedValue(null);
      repo.revoke.mockRejectedValue(new Error('API key not found: 999'));
      const routes = buildAdminRoutes({ apiKeyRepo: repo });
      const revokeRoute = routes.find(
        r => r.method === 'DELETE' && r.pattern.test('/api/admin/keys/999')
      );

      const req = createMockReq('DELETE', '/api/admin/keys/999');
      const res = createMockRes();
      const match = '/api/admin/keys/999'.match(revokeRoute!.pattern)!;
      await revokeRoute!.handler(req, res as unknown as http.ServerResponse, match);

      expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
    });
  });
});
