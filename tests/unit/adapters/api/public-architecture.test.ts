import http from 'node:http';

import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for making /api/architecture a public (unauthenticated) endpoint.
 *
 * The auth middleware should skip authentication for /api/architecture
 * the same way it does for /api/health.
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

describe('Public architecture endpoint', () => {
  describe('auth middleware', () => {
    it('allows /api/architecture without authentication', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn();
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({ url: '/api/architecture' });
      const res = createMockRes();

      const allowed = await middleware(req, res);

      expect(allowed).toBe(true);
      expect(validateKey).not.toHaveBeenCalled();
    });

    it('still requires auth for /api/components', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn();
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({ url: '/api/components', headers: {} });
      const res = createMockRes();

      const allowed = await middleware(req, res);

      expect(allowed).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything());
    });

    it('still requires auth for POST /api/edges', async () => {
      const { createAuthMiddleware } =
        await import('../../../../src/adapters/api/auth-middleware.js');
      const validateKey = vi.fn();
      const middleware = createAuthMiddleware({ validateKey });

      const req = createMockReq({ url: '/api/edges', method: 'POST', headers: {} });
      const res = createMockRes();

      const allowed = await middleware(req, res);

      expect(allowed).toBe(false);
    });

    it('still allows /api/health without authentication', async () => {
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
});
