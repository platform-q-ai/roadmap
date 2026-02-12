import { strict as assert } from 'node:assert';
import http from 'node:http';

import { Then, When } from '@cucumber/cucumber';

import type { Feature } from '../../src/domain/index.js';

interface BatchApiWorld {
  nodes: unknown[];
  edges: unknown[];
  versions: unknown[];
  features: Feature[];
  server: http.Server | null;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

async function httpRequest(
  baseUrl: string,
  method: string,
  path: string,
  body?: string
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const contentHeaders = body
      ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      : {};
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { Connection: 'close', ...contentHeaders },
      agent: false,
    };
    const req = http.request(options, res => {
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
        resolve({ status: res.statusCode ?? 500, body: parsed, headers });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ─── When ───────────────────────────────────────────────────────────

When(
  'I send a batch upload of {int} features to {string} version {string}',
  async function (this: BatchApiWorld, count: number, nodeId: string, version: string) {
    const features = Array.from({ length: count }, (_, i) => ({
      filename: `gen-${i}.feature`,
      content: `Feature: Gen ${i}\n  Scenario: S${i}\n    Given a step`,
    }));
    const body = JSON.stringify({ features });
    const path = `/api/components/${nodeId}/versions/${version}/features/batch`;
    this.response = await httpRequest(this.baseUrl, 'POST', path, body);
  }
);

// ─── Then ───────────────────────────────────────────────────────────

Then('the error references {string}', function (this: BatchApiWorld, filename: string) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body as Record<string, unknown>;
  const errors = body.errors as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(errors), `Expected errors to be an array, got ${typeof errors}`);
  const found = errors.some(
    e => String(e.filename) === filename || String(e.error).includes(filename)
  );
  assert.ok(found, `Expected errors to reference "${filename}", got: ${JSON.stringify(errors)}`);
});

Then(
  '{string} has feature {string} under version {string}',
  function (this: BatchApiWorld, nodeId: string, filename: string, version: string) {
    assert.ok(this.features, 'No features in world');
    const found = this.features.some(
      f => f.node_id === nodeId && f.filename === filename && f.version === version
    );
    assert.ok(
      found,
      `Expected "${nodeId}" to have feature "${filename}" under "${version}". ` +
        `Features: ${JSON.stringify(this.features.map(f => ({ node_id: f.node_id, filename: f.filename, version: f.version })))}`
    );
  }
);
