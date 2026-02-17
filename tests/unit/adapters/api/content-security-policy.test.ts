import http from 'node:http';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for Content-Security-Policy, Referrer-Policy,
 * and Permissions-Policy headers on API responses.
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

describe('Content security headers', () => {
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

  it('returns Content-Security-Policy header', async () => {
    const res = await httpGet(port, '/api/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('CSP header includes default-src directive', async () => {
    const res = await httpGet(port, '/api/health');
    expect(res.headers['content-security-policy']).toContain('default-src');
  });

  it('returns Referrer-Policy header set to no-referrer', async () => {
    const res = await httpGet(port, '/api/health');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('returns Permissions-Policy header', async () => {
    const res = await httpGet(port, '/api/health');
    expect(res.headers['permissions-policy']).toBeDefined();
  });
});
