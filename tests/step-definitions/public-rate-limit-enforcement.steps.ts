import { strict as assert } from 'node:assert';
import http from 'node:http';

import { Given, Then, When } from '@cucumber/cucumber';

/**
 * Step definitions for the public-rate-limit-enforcement feature.
 *
 * Tests that public endpoints (/api/architecture, /api/health) actually
 * reject requests with 429 when the rate limit bucket is exhausted,
 * instead of silently allowing them through.
 */

interface PublicRateLimitWorld {
  server: http.Server | null;
  baseUrl: string;
  responses: Array<{ status: number; headers: Record<string, string>; body: unknown }>;
  publicRateLimit: number;
  [key: string]: unknown;
}

function httpGet(
  baseUrl: string,
  path: string
): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { Connection: 'close' },
        agent: false,
      },
      res => {
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
          const headers: Record<string, string> = {};
          for (const [key, val] of Object.entries(res.headers)) {
            if (typeof val === 'string') {
              headers[key] = val;
            }
          }
          resolve({ status: res.statusCode ?? 500, headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── Given steps ──────────────────────────────────────────────────────

Given(
  'an API server with a public rate limit of {int} requests per window',
  async function (this: PublicRateLimitWorld, limit: number) {
    // Dynamic imports to allow RED phase (module may not exist yet)
    const { createApp } = await import('../../src/adapters/api/server.js');
    const { RateLimiter } = await import('../../src/adapters/api/rate-limiter.js');

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

    const rateLimiter = new RateLimiter({ defaultLimit: limit });
    this.publicRateLimit = limit;

    const server = createApp(
      { nodeRepo, edgeRepo, versionRepo, featureRepo, componentPositionRepo },
      { rateLimiter }
    );

    await new Promise<void>(resolve => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.server = server;
    this.responses = [];
  }
);

// ── When steps ───────────────────────────────────────────────────────

When(
  'I send {int} GET request(s) to the public {string} endpoint',
  async function (this: PublicRateLimitWorld, count: number, path: string) {
    this.responses = [];
    for (let i = 0; i < count; i++) {
      const resp = await httpGet(this.baseUrl, path);
      this.responses.push(resp);
    }
  }
);

// ── Then steps ───────────────────────────────────────────────────────

Then('all requests return HTTP 200', function (this: PublicRateLimitWorld) {
  assert.ok(this.responses.length > 0, 'Expected at least one response');
  for (const resp of this.responses) {
    assert.equal(resp.status, 200, `Expected 200 but got ${resp.status}`);
  }
});

Then(
  /^the (\d+)(?:st|nd|rd|th) request returns HTTP (\d+)$/,
  function (this: PublicRateLimitWorld, indexStr: string, statusStr: string) {
    const index = parseInt(indexStr, 10);
    const expectedStatus = parseInt(statusStr, 10);
    assert.ok(
      this.responses.length >= index,
      `Only ${this.responses.length} responses, need ${index}`
    );
    const resp = this.responses[index - 1];
    assert.equal(
      resp.status,
      expectedStatus,
      `Request #${index}: expected ${expectedStatus} but got ${resp.status}`
    );
  }
);

Then(
  'the response body contains error code {string}',
  function (this: PublicRateLimitWorld, code: string) {
    const last = this.responses[this.responses.length - 1];
    assert.ok(last, 'No response');
    const body = last.body as Record<string, unknown>;
    assert.equal(body.code, code, `Expected error code "${code}" but got "${body.code}"`);
  }
);

Then(
  'the response includes a {string} header',
  function (this: PublicRateLimitWorld, header: string) {
    const last = this.responses[this.responses.length - 1];
    assert.ok(last, 'No response');
    const value = last.headers[header.toLowerCase()];
    assert.ok(value !== undefined, `Expected header "${header}" to be present`);
  }
);

Then('the response has {string} header', function (this: PublicRateLimitWorld, header: string) {
  const last = this.responses[this.responses.length - 1];
  assert.ok(last, 'No response');
  const value = last.headers[header.toLowerCase()];
  assert.ok(value !== undefined, `Expected header "${header}" to be present`);
});

// ── Cleanup ──────────────────────────────────────────────────────────

import { After } from '@cucumber/cucumber';

After({ tags: '@v1' }, async function (this: PublicRateLimitWorld) {
  if (this.server) {
    await new Promise<void>(resolve => {
      this.server?.close(() => resolve());
      this.server?.closeAllConnections();
    });
    this.server = null;
  }
});
