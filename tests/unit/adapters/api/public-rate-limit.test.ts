import http from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for public endpoint rate limit enforcement.
 *
 * Verifies that public paths (/api/architecture, /api/health) actually
 * reject requests with 429 when the rate limit bucket is exhausted,
 * rather than silently allowing all requests through.
 */

function buildMinimalRepos() {
  const nodeRepo = {
    findAll: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findByType: vi.fn(async () => []),
    findByLayer: vi.fn(async () => []),
    exists: vi.fn(async () => false),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const edgeRepo = {
    findAll: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findBySource: vi.fn(async () => []),
    findByTarget: vi.fn(async () => []),
    findByType: vi.fn(async () => []),
    findRelationships: vi.fn(async () => []),
    existsBySrcTgtType: vi.fn(async () => false),
    save: vi.fn(async (e: unknown) => e),
    delete: vi.fn(),
  };
  const versionRepo = {
    findAll: vi.fn(async () => []),
    findByNode: vi.fn(async () => []),
    findByNodeAndVersion: vi.fn(async () => null),
    save: vi.fn(),
    deleteByNode: vi.fn(),
  };
  const featureRepo = {
    findAll: vi.fn(async () => []),
    findByNode: vi.fn(async () => []),
    findByNodeAndVersion: vi.fn(async () => []),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersionAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersion: vi.fn(async () => 0),
    search: async () => [],
    findByNodeVersionAndFilename: vi.fn(async () => null),
  };
  const componentPositionRepo = {
    findByComponentId: vi.fn(() => null),
    findAll: vi.fn(() => []),
    save: vi.fn((p: unknown) => p),
    delete: vi.fn(),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo, componentPositionRepo };
}

function httpGet(
  port: number,
  path: string
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: 'GET',
        path,
        headers: { Connection: 'close' },
        agent: false,
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') {
              headers[k] = v;
            }
          }
          resolve({ status: res.statusCode ?? 500, headers, body: data });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('Public rate limit enforcement', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const { createApp } = await import('@adapters/api/index.js');
    const { RateLimiter } = await import('@adapters/api/rate-limiter.js');

    const repos = buildMinimalRepos();
    const rateLimiter = new RateLimiter({ defaultLimit: 3 });

    server = createApp(repos, { rateLimiter });
    await new Promise<void>(resolve => {
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  it('allows public endpoint requests within the limit', async () => {
    // With defaultLimit=3, first 3 requests to the public bucket should succeed
    const res1 = await httpGet(port, '/api/architecture');
    expect(res1.status).toBe(200);
  });

  it('returns rate limit headers on public endpoint responses', async () => {
    const res = await httpGet(port, '/api/architecture');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('returns 429 when public rate limit is exceeded', async () => {
    // The server was created with defaultLimit=3. After the two requests above,
    // plus one more = 3 total. The 4th should be rejected.
    // Send enough to exhaust the bucket.
    const responses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await httpGet(port, '/api/architecture');
      responses.push(res.status);
    }
    // At least the last request should be 429
    expect(responses).toContain(429);
  });

  it('includes Retry-After header on 429 response', async () => {
    // Bucket should already be exhausted from previous tests
    const res = await httpGet(port, '/api/architecture');
    if (res.status === 429) {
      expect(res.headers['retry-after']).toBeDefined();
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    }
  });

  it('returns RATE_LIMIT_EXCEEDED error code in 429 body', async () => {
    const res = await httpGet(port, '/api/architecture');
    if (res.status === 429) {
      const body = JSON.parse(res.body);
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error).toBe('Rate limit exceeded');
      expect(body.request_id).toBeDefined();
    }
  });
});
