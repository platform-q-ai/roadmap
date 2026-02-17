import { strict as assert } from 'node:assert';
import http from 'node:http';

import { After, Given, Then, When } from '@cucumber/cucumber';

/**
 * Step definitions for the content-security-policy feature.
 *
 * Tests that the API server sends CSP, Referrer-Policy, and
 * Permissions-Policy headers on all responses.
 */

interface CspWorld {
  server: http.Server | null;
  baseUrl: string;
  response: { status: number; headers: Record<string, string>; body: unknown } | null;
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

Given('an API server is running with security headers', async function (this: CspWorld) {
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
  this.response = null;
});

// ── When steps ───────────────────────────────────────────────────────

When(
  'I send a GET request to the {string} endpoint',
  async function (this: CspWorld, path: string) {
    this.response = await httpGet(this.baseUrl, path);
  }
);

// ── Then steps ───────────────────────────────────────────────────────

Then('the response contains header {string}', function (this: CspWorld, header: string) {
  assert.ok(this.response, 'No response');
  const value = this.response.headers[header.toLowerCase()];
  assert.ok(value !== undefined, `Expected header "${header}" to be present`);
});

Then(
  'the {string} header value contains {string}',
  function (this: CspWorld, header: string, expected: string) {
    assert.ok(this.response, 'No response');
    const value = this.response.headers[header.toLowerCase()];
    assert.ok(value, `Header "${header}" not found`);
    assert.ok(
      value.includes(expected),
      `Expected "${header}" header to contain "${expected}", got "${value}"`
    );
  }
);

Then(
  'the {string} header value is {string}',
  function (this: CspWorld, header: string, expected: string) {
    assert.ok(this.response, 'No response');
    const value = this.response.headers[header.toLowerCase()];
    assert.ok(value, `Header "${header}" not found`);
    assert.equal(value, expected, `Expected "${header}" to be "${expected}", got "${value}"`);
  }
);

// ── Cleanup ──────────────────────────────────────────────────────────

After({ tags: '@v1' }, async function (this: CspWorld) {
  if (this.server) {
    await new Promise<void>(resolve => {
      this.server?.close(() => resolve());
      this.server?.closeAllConnections();
    });
    this.server = null;
  }
});
