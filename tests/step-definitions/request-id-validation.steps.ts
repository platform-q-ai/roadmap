import { strict as assert } from 'node:assert';
import http from 'node:http';

import { After, Given, Then, When } from '@cucumber/cucumber';

/**
 * Step definitions for the request-id-validation feature.
 *
 * Tests that the server validates X-Request-Id for length and format,
 * falling back to a generated UUID for invalid values.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RequestIdWorld {
  server: http.Server | null;
  baseUrl: string;
  responseRequestId: string;
  [key: string]: unknown;
}

function httpGetWithRequestId(
  baseUrl: string,
  requestId?: string
): Promise<{ status: number; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/health', baseUrl);
    const headers: Record<string, string> = { Connection: 'close' };
    if (requestId !== undefined) {
      headers['X-Request-Id'] = requestId;
    }
    const req = http.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers,
        agent: false,
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          const respHeaders: Record<string, string> = {};
          for (const [key, val] of Object.entries(res.headers)) {
            if (typeof val === 'string') {
              respHeaders[key] = val;
            }
          }
          resolve({ status: res.statusCode ?? 500, headers: respHeaders });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── Given steps ──────────────────────────────────────────────────────

Given('an API server is running with request ID validation', async function (this: RequestIdWorld) {
  const { createApp } = await import('../../src/adapters/api/server.js');

  const nodeRepo = {
    findAll: async () => [],
    findById: async () => null,
    findByType: async () => [],
    findByLayer: async () => [],
    exists: async () => false,
    save: async () => {},
    delete: async () => {},
  };
  const edgeRepo = {
    findAll: async () => [],
    findById: async () => null,
    findBySource: async () => [],
    findByTarget: async () => [],
    findByType: async () => [],
    findRelationships: async () => [],
    existsBySrcTgtType: async () => false,
    save: async (e: unknown) => e as never,
    delete: async () => {},
  };
  const versionRepo = {
    findAll: async () => [],
    findByNode: async () => [],
    findByNodeAndVersion: async () => null,
    save: async () => {},
    deleteByNode: async () => {},
  };
  const featureRepo = {
    findAll: async () => [],
    findByNode: async () => [],
    findByNodeAndVersion: async () => [],
    getStepCountSummary: async () => ({ totalSteps: 0, featureCount: 0 }),
    save: async () => {},
    saveMany: async () => {},
    deleteAll: async () => {},
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
    deleteByNodeAndVersionAndFilename: async () => false,
    deleteByNodeAndVersion: async () => 0,
    search: async () => [],
    findByNodeVersionAndFilename: async () => null,
  };
  const componentPositionRepo = {
    findByComponentId: () => null,
    findAll: () => [],
    save: (p: unknown) => p as never,
    delete: () => {},
  };

  const server = createApp(
    { nodeRepo, edgeRepo, versionRepo, featureRepo, componentPositionRepo },
    {}
  );

  await new Promise<void>(resolve => {
    server.listen(0, () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  this.baseUrl = `http://127.0.0.1:${port}`;
  this.server = server;
  this.responseRequestId = '';
});

// ── When steps ───────────────────────────────────────────────────────

When(
  'I send a request with X-Request-Id {string}',
  async function (this: RequestIdWorld, requestId: string) {
    const resp = await httpGetWithRequestId(this.baseUrl, requestId);
    this.responseRequestId = resp.headers['x-request-id'] ?? '';
  }
);

When(
  'I send a request with an X-Request-Id longer than {int} characters',
  async function (this: RequestIdWorld, maxLen: number) {
    const longId = 'a'.repeat(maxLen + 1);
    const resp = await httpGetWithRequestId(this.baseUrl, longId);
    this.responseRequestId = resp.headers['x-request-id'] ?? '';
  }
);

// ── Then steps ───────────────────────────────────────────────────────

Then('the response X-Request-Id is {string}', function (this: RequestIdWorld, expected: string) {
  assert.equal(
    this.responseRequestId,
    expected,
    `Expected X-Request-Id "${expected}", got "${this.responseRequestId}"`
  );
});

Then('the response X-Request-Id is a valid UUID', function (this: RequestIdWorld) {
  assert.ok(
    UUID_RE.test(this.responseRequestId),
    `Expected a valid UUID, got "${this.responseRequestId}"`
  );
});

// ── Cleanup ──────────────────────────────────────────────────────────

After({ tags: '@v1' }, async function (this: RequestIdWorld) {
  if (this.server) {
    await new Promise<void>(resolve => {
      this.server?.close(() => resolve());
      this.server?.closeAllConnections();
    });
    this.server = null;
  }
});
