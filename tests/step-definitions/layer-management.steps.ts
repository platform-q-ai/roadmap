import { strict as assert } from 'node:assert';

import { Given, Then } from '@cucumber/cucumber';

import { Edge, Node, Version } from '../../src/domain/index.js';

interface LayerWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

// ─── Helpers ────────────────────────────────────────────────────────

function ensureLayer(world: LayerWorld, layerId: string): void {
  if (!world.nodes) {
    world.nodes = [];
  }
  if (!world.nodes.some(n => n.id === layerId)) {
    world.nodes.push(new Node({ id: layerId, name: layerId, type: 'layer' }));
  }
}

function ensureComponentInLayer(world: LayerWorld, compId: string, layerId: string): void {
  if (!world.nodes) {
    world.nodes = [];
  }
  if (!world.edges) {
    world.edges = [];
  }
  if (!world.versions) {
    world.versions = [];
  }
  ensureLayer(world, layerId);
  if (!world.nodes.some(n => n.id === compId)) {
    world.nodes.push(new Node({ id: compId, name: compId, type: 'component', layer: layerId }));
    const nextId = world.edges.length > 0 ? Math.max(...world.edges.map(e => e.id ?? 0)) + 1 : 1;
    world.edges.push(
      new Edge({ id: nextId, source_id: layerId, target_id: compId, type: 'CONTAINS' })
    );
    for (const ver of Version.VERSIONS) {
      world.versions.push(
        new Version({ node_id: compId, version: ver, progress: 0, status: 'planned' })
      );
    }
  }
}

// ─── Given ──────────────────────────────────────────────────────────

Given(
  'layer {string} contains components {string} and {string}',
  function (this: LayerWorld, layerId: string, compA: string, compB: string) {
    ensureComponentInLayer(this, compA, layerId);
    ensureComponentInLayer(this, compB, layerId);
  }
);

Given(
  'component {string} is in layer {string}',
  function (this: LayerWorld, compId: string, layerId: string) {
    ensureComponentInLayer(this, compId, layerId);
  }
);

Given('layer {string} exists', function (this: LayerWorld, layerId: string) {
  ensureLayer(this, layerId);
});

// ─── Then ───────────────────────────────────────────────────────────

Then('the response body is an array of layer objects', function (this: LayerWorld) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body;
  assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
});

Then(
  'each layer has field {string} with value {string}',
  function (this: LayerWorld, field: string, value: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    for (const item of body) {
      assert.equal(
        String(item[field]),
        value,
        `Expected each item to have "${field}" = "${value}", got "${item[field]}"`
      );
    }
  }
);

Then(
  'the response body has field {string} as an array of {int} items',
  function (this: LayerWorld, field: string, count: number) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const arr = body[field];
    assert.ok(Array.isArray(arr), `Expected "${field}" to be array, got ${typeof arr}`);
    assert.equal(
      (arr as unknown[]).length,
      count,
      `Expected "${field}" to have ${count} items, got ${(arr as unknown[]).length}`
    );
  }
);

Then(
  'the CONTAINS edge from {string} to {string} is removed',
  function (this: LayerWorld, source: string, target: string) {
    assert.ok(this.response, 'No response received');
    const found = this.edges.some(
      e => e.source_id === source && e.target_id === target && e.type === 'CONTAINS'
    );
    assert.ok(
      !found,
      `Expected CONTAINS edge from "${source}" to "${target}" to be removed, but it still exists`
    );
  }
);

Then(
  'a CONTAINS edge from {string} to {string} exists',
  function (this: LayerWorld, source: string, target: string) {
    assert.ok(this.response, 'No response received');
    const found = this.edges.some(
      e => e.source_id === source && e.target_id === target && e.type === 'CONTAINS'
    );
    assert.ok(
      found,
      `Expected CONTAINS edge from "${source}" to "${target}" to exist, but it was not found`
    );
  }
);
