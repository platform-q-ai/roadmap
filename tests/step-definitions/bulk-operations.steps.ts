import { strict as assert } from 'node:assert';
import http from 'node:http';

import { Given, Then, When } from '@cucumber/cucumber';

import { Edge } from '../../src/domain/entities/edge.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';

interface ApiWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: unknown[];
  server: http.Server | null;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  currentApiKey: string | null;
  [key: string]: unknown;
}

// ─── Given steps ────────────────────────────────────────────────────

Given('component {string} already exists', function (this: ApiWorld, id: string) {
  if (!this.nodes) {
    this.nodes = [];
  }
  if (!this.edges) {
    this.edges = [];
  }
  if (!this.versions) {
    this.versions = [];
  }
  if (!this.nodes.some(n => n.id === id)) {
    const layerId = 'supervisor-layer';
    if (!this.nodes.some(n => n.id === layerId)) {
      this.nodes.push(new Node({ id: layerId, name: layerId, type: 'layer' }));
    }
    this.nodes.push(new Node({ id, name: id, type: 'component', layer: layerId }));
    this.edges.push(
      new Edge({
        id: this.edges.length + 500,
        source_id: layerId,
        target_id: id,
        type: 'CONTAINS',
      })
    );
    for (const ver of Version.VERSIONS) {
      this.versions.push(
        new Version({ node_id: id, version: ver, progress: 0, status: 'planned' })
      );
    }
  }
});

Given(
  'components {string}, {string}, {string} exist',
  function (this: ApiWorld, id1: string, id2: string, id3: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    if (!this.edges) {
      this.edges = [];
    }
    if (!this.versions) {
      this.versions = [];
    }

    const layerId = 'supervisor-layer';
    if (!this.nodes.some(n => n.id === layerId)) {
      this.nodes.push(new Node({ id: layerId, name: layerId, type: 'layer' }));
    }

    for (const id of [id1, id2, id3]) {
      if (!this.nodes.some(n => n.id === id)) {
        this.nodes.push(new Node({ id, name: id, type: 'component', layer: layerId }));
        this.edges.push(
          new Edge({
            id: this.edges.length + 600,
            source_id: layerId,
            target_id: id,
            type: 'CONTAINS',
          })
        );
        for (const ver of Version.VERSIONS) {
          this.versions.push(
            new Version({ node_id: id, version: ver, progress: 0, status: 'planned' })
          );
        }
      }
    }
  }
);

// ─── When steps ─────────────────────────────────────────────────────

When(
  'I send a POST request to {string} with {int} components',
  async function (this: ApiWorld, path: string, count: number) {
    const components = Array.from({ length: count }, (_, i) => ({
      id: `gen-bulk-${i}`,
      name: `Generated ${i}`,
      type: 'component',
      layer: 'supervisor-layer',
    }));
    const body = JSON.stringify({ components });

    const url = new URL(path, this.baseUrl);
    const headers: Record<string, string> = {
      Connection: 'close',
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(body)),
    };
    if (this.currentApiKey) {
      headers['Authorization'] = `Bearer ${this.currentApiKey}`;
    }

    this.response = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: 'POST',
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
            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = data;
            }
            const resHeaders: Record<string, string> = {};
            for (const [key, val] of Object.entries(res.headers)) {
              if (typeof val === 'string') {
                resHeaders[key] = val;
              }
            }
            resolve({ status: res.statusCode ?? 500, body: parsed, headers: resHeaders });
          });
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
);

// ─── Then steps ─────────────────────────────────────────────────────

Then(
  'the response body has field {string} with value {int}',
  function (this: ApiWorld, field: string, expected: number) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(
      field in body,
      `Field "${field}" not found in response body: ${JSON.stringify(body)}`
    );
    assert.strictEqual(
      body[field],
      expected,
      `Expected field "${field}" to be ${expected}, got ${JSON.stringify(body[field])}`
    );
  }
);

Then(
  'the response body has field {string} as an array of {int} error(s)',
  function (this: ApiWorld, field: string, expectedLength: number) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(
      field in body,
      `Field "${field}" not found in response body: ${JSON.stringify(body)}`
    );
    assert.ok(
      Array.isArray(body[field]),
      `Expected field "${field}" to be an array, got ${typeof body[field]}`
    );
    assert.strictEqual(
      (body[field] as unknown[]).length,
      expectedLength,
      `Expected "${field}" to have ${expectedLength} item(s), got ${(body[field] as unknown[]).length}`
    );
  }
);

Then(
  'the error references {string} with status {int}',
  function (this: ApiWorld, expectedId: string, expectedStatus: number) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const errors = body['errors'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(errors), 'Expected errors to be an array');
    const match = errors.find(e => e['id'] === expectedId);
    assert.ok(match, `No error referencing id "${expectedId}" found in ${JSON.stringify(errors)}`);
    assert.strictEqual(
      match['status'],
      expectedStatus,
      `Expected error for "${expectedId}" to have status ${expectedStatus}, got ${match['status']}`
    );
  }
);
