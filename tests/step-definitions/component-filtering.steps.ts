import { strict as assert } from 'node:assert';

import { Given, Then } from '@cucumber/cucumber';

import { Node } from '../../src/domain/entities/node.js';

interface ApiWorld {
  nodes: Node[];
  edges: unknown[];
  versions: unknown[];
  features: unknown[];
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

// ─── Given steps ────────────────────────────────────────────────────

Given('the database contains {int} components', function (this: ApiWorld, count: number) {
  if (!this.nodes) {
    this.nodes = [];
  }
  // Ensure supervisor-layer exists
  if (!this.nodes.some(n => n.id === 'supervisor-layer')) {
    this.nodes.push(new Node({ id: 'supervisor-layer', name: 'Supervisor Layer', type: 'layer' }));
  }
  // Add the requested number of non-layer components
  for (let i = 0; i < count; i++) {
    const id = `gen-comp-${i}`;
    if (!this.nodes.some(n => n.id === id)) {
      this.nodes.push(
        new Node({ id, name: `Component ${i}`, type: 'component', layer: 'supervisor-layer' })
      );
    }
  }
});

Given('components with tag {string} exist', function (this: ApiWorld, tag: string) {
  if (!this.nodes) {
    this.nodes = [];
  }
  // Ensure supervisor-layer exists
  if (!this.nodes.some(n => n.id === 'supervisor-layer')) {
    this.nodes.push(new Node({ id: 'supervisor-layer', name: 'Supervisor Layer', type: 'layer' }));
  }
  // Add a few components with the given tag
  const taggedIds = [`tagged-${tag}-1`, `tagged-${tag}-2`];
  for (const id of taggedIds) {
    if (!this.nodes.some(n => n.id === id)) {
      this.nodes.push(
        new Node({
          id,
          name: `${tag} Component`,
          type: 'component',
          layer: 'supervisor-layer',
          tags: [tag],
        })
      );
    }
  }
});

// ─── Then steps ─────────────────────────────────────────────────────

Then('layers are excluded from the result', function (this: ApiWorld) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body;
  assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
  const items = body as Array<Record<string, unknown>>;
  for (const item of items) {
    assert.notStrictEqual(
      item.type,
      'layer',
      `Found a layer node in the response: ${JSON.stringify(item)}`
    );
  }
});

Then(
  'every item in the response has type {string}',
  function (this: ApiWorld, expectedType: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    const items = body as Array<Record<string, unknown>>;
    for (const item of items) {
      assert.strictEqual(
        item.type,
        expectedType,
        `Expected type "${expectedType}", got "${item.type}" for item ${item.id}`
      );
    }
  }
);

Then(
  'every item in the response has layer {string}',
  function (this: ApiWorld, expectedLayer: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    const items = body as Array<Record<string, unknown>>;
    for (const item of items) {
      assert.strictEqual(
        item.layer,
        expectedLayer,
        `Expected layer "${expectedLayer}", got "${item.layer}" for item ${item.id}`
      );
    }
  }
);

Then(
  'every item in the response has {string} in its tags',
  function (this: ApiWorld, expectedTag: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    const items = body as Array<Record<string, unknown>>;
    assert.ok(items.length > 0, 'Expected at least one item in the response');
    for (const item of items) {
      const tags = item.tags as string[];
      assert.ok(
        Array.isArray(tags) && tags.includes(expectedTag),
        `Expected tags to include "${expectedTag}", got ${JSON.stringify(tags)} for item ${item.id}`
      );
    }
  }
);

Then(
  'every item has {string} in its name \\(case-insensitive)',
  function (this: ApiWorld, searchTerm: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    const items = body as Array<Record<string, unknown>>;
    const lowerSearch = searchTerm.toLowerCase();
    for (const item of items) {
      const name = String(item.name).toLowerCase();
      assert.ok(
        name.includes(lowerSearch),
        `Expected name to contain "${searchTerm}", got "${item.name}" for item ${item.id}`
      );
    }
  }
);

Then(
  'every item has type {string} and layer {string}',
  function (this: ApiWorld, expectedType: string, expectedLayer: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    const items = body as Array<Record<string, unknown>>;
    for (const item of items) {
      assert.strictEqual(
        item.type,
        expectedType,
        `Expected type "${expectedType}", got "${item.type}" for item ${item.id}`
      );
      assert.strictEqual(
        item.layer,
        expectedLayer,
        `Expected layer "${expectedLayer}", got "${item.layer}" for item ${item.id}`
      );
    }
  }
);

Then('the response body is an empty array', function (this: ApiWorld) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body;
  assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
  assert.strictEqual(
    (body as unknown[]).length,
    0,
    `Expected empty array, got ${(body as unknown[]).length} items`
  );
});
