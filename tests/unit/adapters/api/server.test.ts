import http from 'node:http';

import type { RequestLogEntry } from '@adapters/api/index.js';
import { createApp } from '@adapters/api/index.js';
import { RateLimiter } from '@adapters/api/rate-limiter.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

function buildMinimalRepos() {
  const nodeRepo: INodeRepository = {
    findAll: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findByType: vi.fn(async () => []),
    findByLayer: vi.fn(async () => []),
    exists: vi.fn(async () => false),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findBySource: vi.fn(async () => []),
    findByTarget: vi.fn(async () => []),
    findByType: vi.fn(async () => []),
    findRelationships: vi.fn(async () => []),
    existsBySrcTgtType: vi.fn(async () => false),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const versionRepo: IVersionRepository = {
    findAll: vi.fn(async () => []),
    findByNode: vi.fn(async () => []),
    findByNodeAndVersion: vi.fn(async () => null),
    save: vi.fn(),
    deleteByNode: vi.fn(),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn(async () => []),
    findByNode: vi.fn(async () => []),
    findByNodeAndVersion: vi.fn(async () => []),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

function request(
  port: number,
  method: string,
  path: string,
  opts?: { headers?: Record<string, string> }
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: { Connection: 'close', ...opts?.headers },
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

describe('Server integration (auth, rate limiting, CORS, logging)', () => {
  let server: http.Server;
  let port: number;
  const logs: RequestLogEntry[] = [];

  beforeAll(async () => {
    const repos = buildMinimalRepos();
    const authMiddleware = async (
      req: http.IncomingMessage,
      res: http.ServerResponse
    ): Promise<boolean> => {
      const authHeader = req.headers['authorization'];
      if (req.url === '/api/health') {
        return true;
      }
      if (!authHeader) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return false;
      }
      return true;
    };

    const rateLimiter = new RateLimiter({ defaultLimit: 5 });

    server = createApp(repos, {
      authMiddleware,
      rateLimiter,
      allowedOrigins: ['https://allowed.example.com'],
      onLog: entry => logs.push(entry),
    });

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

  it('returns 401 when auth middleware rejects (no API key)', async () => {
    const res = await request(port, 'GET', '/api/components');
    expect(res.status).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Authentication required');
  });

  it('passes through when auth middleware allows (health endpoint)', async () => {
    const res = await request(port, 'GET', '/api/health');
    expect(res.status).toBe(200);
  });

  it('returns 204 for OPTIONS preflight', async () => {
    const res = await request(port, 'OPTIONS', '/api/components', {
      headers: { Origin: 'https://allowed.example.com' },
    });
    expect(res.status).toBe(204);
  });

  it('sets CORS header for allowed origin', async () => {
    const res = await request(port, 'OPTIONS', '/api/components', {
      headers: { Origin: 'https://allowed.example.com' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
  });

  it('does not set CORS header for disallowed origin', async () => {
    const res = await request(port, 'OPTIONS', '/api/components', {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('includes security headers on all responses', async () => {
    const res = await request(port, 'GET', '/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('uses client-provided X-Request-Id', async () => {
    const res = await request(port, 'GET', '/api/health', {
      headers: { 'X-Request-Id': 'my-custom-id' },
    });
    expect(res.headers['x-request-id']).toBe('my-custom-id');
  });

  it('returns rate limit headers on API responses', async () => {
    const res = await request(port, 'GET', '/api/health');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(port, 'GET', '/api/nonexistent', {
      headers: { Authorization: 'Bearer test' },
    });
    expect(res.status).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.request_id).toBeDefined();
  });

  it('logs requests via onLog callback', async () => {
    logs.length = 0;
    await request(port, 'GET', '/api/health');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].method).toBe('GET');
    expect(logs[0].path).toBe('/api/health');
    expect(logs[0].status).toBe(200);
    expect(logs[0].request_id).toBeDefined();
    expect(typeof logs[0].duration).toBe('number');
  });

  it('logs auth rejections', async () => {
    logs.length = 0;
    await request(port, 'GET', '/api/components');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe(401);
  });

  it('logs OPTIONS requests', async () => {
    logs.length = 0;
    await request(port, 'OPTIONS', '/api/components');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe(204);
  });

  it('logs 404 responses', async () => {
    logs.length = 0;
    await request(port, 'GET', '/api/nonexistent-for-log', {
      headers: { Authorization: 'Bearer test' },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe(404);
  });
});

describe('Server without auth/rate limiting (default mode)', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const repos = buildMinimalRepos();
    server = createApp(repos);
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

  it('allows requests without auth when no middleware configured', async () => {
    const res = await request(port, 'GET', '/api/health');
    expect(res.status).toBe(200);
  });

  it('sets CORS to wildcard when no allowedOrigins', async () => {
    const res = await request(port, 'GET', '/api/health', {
      headers: { Origin: 'http://anything.example.com' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
