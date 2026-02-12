import http from 'node:http';

import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the auth middleware.
 *
 * Tests the middleware function in isolation by calling it with
 * mock request/response objects.
 */

function createMockReq(overrides: Record<string, unknown> = {}): http.IncomingMessage {
  const req = {
    method: 'GET',
    url: '/api/components',
    headers: {},
    ...overrides,
  } as unknown as http.IncomingMessage;
  return req;
}

function createMockRes(): http.ServerResponse & { statusCode: number; body: string } {
  const res = {
    statusCode: 200,
    body: '',
    headers: {} as Record<string, string>,
    writeHead: vi.fn(function (this: { statusCode: number }, status: number) {
      this.statusCode = status;
    }),
    end: vi.fn(function (this: { body: string }, data?: string) {
      this.body = data ?? '';
    }),
    setHeader: vi.fn(function (this: { headers: Record<string, string> }, k: string, v: string) {
      this.headers[k] = v;
    }),
    getHeader: vi.fn(function (this: { headers: Record<string, string> }, k: string) {
      return this.headers[k];
    }),
  } as unknown as http.ServerResponse & { statusCode: number; body: string };
  return res;
}

const VALID_KEY = {
  status: 'valid' as const,
  key: { id: 1, name: 'bot', scopes: ['read'], is_active: true },
};
const VALID_KEY_RW = {
  status: 'valid' as const,
  key: { id: 1, name: 'writer', scopes: ['read', 'write'], is_active: true },
};
const VALID_KEY_ADMIN = {
  status: 'valid' as const,
  key: { id: 1, name: 'admin', scopes: ['read', 'write', 'admin'], is_active: true },
};

describe('Auth Middleware', () => {
  describe('health endpoint exemption', () => {
    it('allows /api/health without authentication', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn();
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({ url: '/api/health' });
      const res = createMockRes();

      const allowed = await middleware(req, res);

      expect(allowed).toBe(true);
      expect(validateKey).not.toHaveBeenCalled();
    });
  });

  describe('Bearer token authentication', () => {
    it('extracts and validates Bearer token from Authorization header', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn().mockResolvedValue(VALID_KEY);
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({
        headers: { authorization: 'Bearer rmap_deadbeefdeadbeefdeadbeefdeadbeef' },
      });
      const res = createMockRes();

      const allowed = await middleware(req, res);

      expect(allowed).toBe(true);
      expect(validateKey).toHaveBeenCalledWith('rmap_deadbeefdeadbeefdeadbeefdeadbeef');
    });

    it('returns 401 when no auth header is present', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn();
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({ headers: {} });
      const res = createMockRes();

      const allowed = await middleware(req, res);

      expect(allowed).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything());
    });

    it('returns 401 when key is invalid', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn().mockResolvedValue({ status: 'invalid' });
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({
        headers: { authorization: 'Bearer rmap_invalidinvalidinvalidinvalid' },
      });
      const res = createMockRes();

      const allowed = await middleware(req, res);

      expect(allowed).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything());
    });
  });

  describe('X-API-Key header alternative', () => {
    it('accepts key via X-API-Key header', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn().mockResolvedValue(VALID_KEY);
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({
        headers: { 'x-api-key': 'rmap_deadbeefdeadbeefdeadbeefdeadbeef' },
      });
      const res = createMockRes();

      const allowed = await middleware(req, res);

      expect(allowed).toBe(true);
      expect(validateKey).toHaveBeenCalledWith('rmap_deadbeefdeadbeefdeadbeefdeadbeef');
    });
  });

  describe('scope-based authorization', () => {
    it('allows GET requests with read scope', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn().mockResolvedValue(VALID_KEY);
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({
        method: 'GET',
        url: '/api/components',
        headers: { authorization: 'Bearer rmap_test1234567890test1234567890' },
      });
      const res = createMockRes();

      const allowed = await middleware(req, res);
      expect(allowed).toBe(true);
    });

    it('rejects POST with read-only scope (requires write)', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn().mockResolvedValue(VALID_KEY);
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({
        method: 'POST',
        url: '/api/components',
        headers: { authorization: 'Bearer rmap_test1234567890test1234567890' },
      });
      const res = createMockRes();

      const allowed = await middleware(req, res);
      expect(allowed).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
    });

    it('requires admin scope for /api/admin/* routes', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn().mockResolvedValue(VALID_KEY_RW);
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({
        method: 'GET',
        url: '/api/admin/keys',
        headers: { authorization: 'Bearer rmap_test1234567890test1234567890' },
      });
      const res = createMockRes();

      const allowed = await middleware(req, res);
      expect(allowed).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
    });

    it('allows admin scope for /api/admin/* routes', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn().mockResolvedValue(VALID_KEY_ADMIN);
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({
        method: 'GET',
        url: '/api/admin/keys',
        headers: { authorization: 'Bearer rmap_test1234567890test1234567890' },
      });
      const res = createMockRes();

      const allowed = await middleware(req, res);
      expect(allowed).toBe(true);
    });
  });

  describe('error response format', () => {
    it('returns JSON error body with error and code fields on 401', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn();
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({ headers: {} });
      const res = createMockRes();

      await middleware(req, res);

      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
    });
  });
});
