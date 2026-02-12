import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { Edge } from '../../src/domain/entities/edge.js';
import { Node } from '../../src/domain/entities/node.js';

interface ApiWorld {
  nodes: Node[];
  edges: Edge[];
  versions: unknown[];
  features: unknown[];
  server: unknown;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  lastEdgeBody?: string;
  [key: string]: unknown;
}

function ensureComponent(world: ApiWorld, id: string): void {
  if (!world.nodes) {
    world.nodes = [];
  }
  if (!world.nodes.some(n => n.id === id)) {
    world.nodes.push(
      new Node({ id, name: `Component ${id}`, type: 'component', layer: 'supervisor-layer' })
    );
  }
}

// ─── Given: edge setup ──────────────────────────────────────────────

Given(
  'components {string} and {string} exist',
  function (this: ApiWorld, id1: string, id2: string) {
    ensureComponent(this, id1);
    ensureComponent(this, id2);
  }
);

Given(
  'component {string} exists but {string} does not',
  function (this: ApiWorld, existsId: string, missingId: string) {
    ensureComponent(this, existsId);
    if (this.nodes) {
      this.nodes = this.nodes.filter(n => n.id !== missingId);
    }
  }
);

Given(
  'an edge from {string} to {string} with type {string} already exists',
  function (this: ApiWorld, src: string, tgt: string, type: string) {
    ensureComponent(this, src);
    ensureComponent(this, tgt);
    if (!this.edges) {
      this.edges = [];
    }
    const nextId = this.edges.length > 0 ? Math.max(...this.edges.map(e => e.id ?? 0)) + 1 : 1;
    this.edges.push(
      new Edge({
        id: nextId,
        source_id: src,
        target_id: tgt,
        type: type as Edge['type'],
      })
    );
    this.lastEdgeBody = JSON.stringify({ source_id: src, target_id: tgt, type });
  }
);

Given(
  'component {string} has {int} inbound and {int} outbound edges',
  function (this: ApiWorld, id: string, inboundCount: number, outboundCount: number) {
    ensureComponent(this, id);
    if (!this.edges) {
      this.edges = [];
    }
    let nextId = this.edges.length > 0 ? Math.max(...this.edges.map(e => e.id ?? 0)) + 1 : 1;
    for (let i = 0; i < inboundCount; i++) {
      const srcId = `inbound-src-${i}`;
      ensureComponent(this, srcId);
      this.edges.push(
        new Edge({
          id: nextId++,
          source_id: srcId,
          target_id: id,
          type: 'DEPENDS_ON',
        })
      );
    }
    for (let i = 0; i < outboundCount; i++) {
      const tgtId = `outbound-tgt-${i}`;
      ensureComponent(this, tgtId);
      this.edges.push(
        new Edge({
          id: nextId++,
          source_id: id,
          target_id: tgtId,
          type: 'DEPENDS_ON',
        })
      );
    }
  }
);

Given('component {string} exists', function (this: ApiWorld, id: string) {
  ensureComponent(this, id);
});

Given('an edge with id {int} exists', function (this: ApiWorld, id: number) {
  if (!this.edges) {
    this.edges = [];
  }
  ensureComponent(this, 'edge-del-src');
  ensureComponent(this, 'edge-del-tgt');
  this.edges = this.edges.filter(e => e.id !== id);
  this.edges.push(
    new Edge({
      id,
      source_id: 'edge-del-src',
      target_id: 'edge-del-tgt',
      type: 'DEPENDS_ON',
    })
  );
});

// ─── When ───────────────────────────────────────────────────────────

When(
  'I send a POST request to {string} with the same edge',
  async function (this: ApiWorld, path: string) {
    assert.ok(this.lastEdgeBody, 'No previous edge body stored');
    const http = await import('node:http');
    const url = new URL(path, this.baseUrl);
    this.response = await new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(this.lastEdgeBody!),
          Connection: 'close',
        },
        agent: false as const,
      };
      const req = http.request(options, res => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
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
      req.write(this.lastEdgeBody!);
      req.end();
    });
  }
);

// ─── Then ───────────────────────────────────────────────────────────

Then(
  'the response body has field {string} as an array of {int} edges',
  function (this: ApiWorld, field: string, count: number) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found in response body`);
    const arr = body[field];
    assert.ok(Array.isArray(arr), `Expected "${field}" to be an array`);
    assert.equal(
      (arr as unknown[]).length,
      count,
      `Expected "${field}" to have ${count} edges, got ${(arr as unknown[]).length}`
    );
  }
);

Then('every edge in the response has type {string}', function (this: ApiWorld, edgeType: string) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body;
  assert.ok(Array.isArray(body), `Expected array response, got ${typeof body}`);
  const edges = body as Array<Record<string, unknown>>;
  for (const edge of edges) {
    assert.equal(edge.type, edgeType, `Expected edge type "${edgeType}", got "${edge.type}"`);
  }
});

Then('the response body is a non-empty array of edge objects', function (this: ApiWorld) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body;
  assert.ok(Array.isArray(body), `Expected array response, got ${typeof body}`);
  assert.ok((body as unknown[]).length > 0, 'Expected non-empty array');
  const first = (body as Array<Record<string, unknown>>)[0];
  assert.ok('source_id' in first, 'Expected edge objects with source_id');
  assert.ok('target_id' in first, 'Expected edge objects with target_id');
  assert.ok('type' in first, 'Expected edge objects with type');
});

Then('the edge no longer exists', function (this: ApiWorld) {
  assert.ok(this.edges, 'No edges in world');
  const edge = this.edges.find(e => e.id === 42);
  assert.ok(!edge, 'Edge with id 42 should have been deleted');
});
