import { strict as assert } from 'node:assert';

import { Given, Then } from '@cucumber/cucumber';

import { Edge } from '../../src/domain/entities/edge.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';

interface ApiWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: unknown[];
  server: unknown;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

// ─── Given ──────────────────────────────────────────────────────────

Given(
  'a component {string} exists in the database with description {string}',
  function (this: ApiWorld, id: string, description: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    if (!this.edges) {
      this.edges = [];
    }
    if (!this.versions) {
      this.versions = [];
    }
    if (!this.nodes.some(n => n.id === 'supervisor-layer')) {
      this.nodes.push(
        new Node({ id: 'supervisor-layer', name: 'Supervisor Layer', type: 'layer' })
      );
    }
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.nodes.push(
      new Node({ id, name: id, type: 'component', layer: 'supervisor-layer', description })
    );
    this.edges.push(
      new Edge({
        id: this.edges.length + 200,
        source_id: 'supervisor-layer',
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
);

// ─── Then ───────────────────────────────────────────────────────────

Then(
  'the response body field {string} contains {string}',
  function (this: ApiWorld, field: string, substring: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(
      field in body,
      `Field "${field}" not found in response body: ${JSON.stringify(body)}`
    );
    const value = String(body[field]);
    assert.ok(
      value.includes(substring),
      `Expected field "${field}" to contain "${substring}", got "${value}"`
    );
  }
);

Then(
  'the response body field {string} does not contain {string}',
  function (this: ApiWorld, field: string, substring: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(
      field in body,
      `Field "${field}" not found in response body: ${JSON.stringify(body)}`
    );
    const value = String(body[field]);
    assert.ok(
      !value.includes(substring),
      `Expected field "${field}" NOT to contain "${substring}", but it does: "${value}"`
    );
  }
);

Then(
  'the architecture response contains a node with description containing {string}',
  function (this: ApiWorld, substring: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as { nodes: Array<{ description?: string }> };
    assert.ok(body.nodes, 'No nodes in architecture response');
    const found = body.nodes.some(n => (n.description ?? '').includes(substring));
    assert.ok(
      found,
      `No node found with description containing "${substring}". Descriptions: ${body.nodes.map(n => n.description ?? '(none)').join('; ')}`
    );
  }
);
