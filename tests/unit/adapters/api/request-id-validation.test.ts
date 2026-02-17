import http from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for X-Request-Id validation.
 *
 * Verifies that the server rejects oversized and unsafe request IDs,
 * falling back to a generated UUID.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildMinimalRepos() {
  return {
    nodeRepo: {
      findAll: vi.fn(async () => []),
      findById: vi.fn(async () => null),
      findByType: vi.fn(async () => []),
      findByLayer: vi.fn(async () => []),
      exists: vi.fn(async () => false),
      save: vi.fn(),
      delete: vi.fn(),
    },
    edgeRepo: {
      findAll: vi.fn(async () => []),
      findById: vi.fn(async () => null),
      findBySource: vi.fn(async () => []),
      findByTarget: vi.fn(async () => []),
      findByType: vi.fn(async () => []),
      findRelationships: vi.fn(async () => []),
      existsBySrcTgtType: vi.fn(async () => false),
      save: vi.fn(async (e: unknown) => e),
      delete: vi.fn(),
    },
    versionRepo: {
      findAll: vi.fn(async () => []),
      findByNode: vi.fn(async () => []),
      findByNodeAndVersion: vi.fn(async () => null),
      save: vi.fn(),
      deleteByNode: vi.fn(),
    },
    featureRepo: {
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
    },
    componentPositionRepo: {
      findByComponentId: vi.fn(() => null),
      findAll: vi.fn(() => []),
      save: vi.fn((p: unknown) => p),
      delete: vi.fn(),
    },
  };
}

function httpGet(
  port: number,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: 'GET',
        path,
        headers: { Connection: 'close', ...headers },
        agent: false,
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') {
              h[k] = v;
            }
          }
          resolve({ status: res.statusCode ?? 500, headers: h, body: data });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('X-Request-Id validation', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const { createApp } = await import('@adapters/api/index.js');
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

  it('accepts a valid short request ID', async () => {
    const res = await httpGet(port, '/api/health', { 'X-Request-Id': 'abc-123' });
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('replaces an overlong request ID with a UUID', async () => {
    const longId = 'a'.repeat(129);
    const res = await httpGet(port, '/api/health', { 'X-Request-Id': longId });
    expect(res.headers['x-request-id']).not.toBe(longId);
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
  });

  it('replaces a request ID with unsafe characters with a UUID', async () => {
    const res = await httpGet(port, '/api/health', {
      'X-Request-Id': 'bad value<script>',
    });
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
  });

  it('generates a UUID when X-Request-Id is empty', async () => {
    const res = await httpGet(port, '/api/health', { 'X-Request-Id': '' });
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
  });

  it('generates a UUID when X-Request-Id is not provided', async () => {
    const res = await httpGet(port, '/api/health');
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
  });
});
