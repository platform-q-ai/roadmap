import { strict as assert } from 'node:assert';

import { Given, Then } from '@cucumber/cucumber';

import { Feature, Node } from '../../src/domain/index.js';

interface RetrievalWorld {
  nodes: Node[];
  edges: unknown[];
  versions: unknown[];
  features: Feature[];
  server: unknown;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

function ensureComponent(world: RetrievalWorld, id: string): void {
  if (!world.nodes) {
    world.nodes = [];
  }
  if (!world.features) {
    world.features = [];
  }
  if (!world.versions) {
    world.versions = [];
  }
  if (!world.edges) {
    world.edges = [];
  }
  if (!world.nodes.some(n => n.id === 'supervisor-layer')) {
    world.nodes.push(new Node({ id: 'supervisor-layer', name: 'Supervisor Layer', type: 'layer' }));
  }
  if (!world.nodes.some(n => n.id === id)) {
    world.nodes.push(new Node({ id, name: id, type: 'component', layer: 'supervisor-layer' }));
  }
}

function makeFeature(nodeId: string, version: string, filename: string): Feature {
  const content = `Feature: ${filename}\n  Scenario: S1\n    Given a step\n    When action\n    Then result`;
  return new Feature({
    node_id: nodeId,
    version,
    filename,
    title: Feature.titleFromContent(content, filename),
    content,
    step_count: Feature.countSteps(content),
  });
}

// ─── Given ──────────────────────────────────────────────────────────

Given(
  'component {string} has {int} features under {string}, {int} under {string}, {int} under {string}',
  function (
    this: RetrievalWorld,
    nodeId: string,
    c1: number,
    v1: string,
    c2: number,
    v2: string,
    c3: number,
    v3: string
  ) {
    ensureComponent(this, nodeId);
    for (let i = 0; i < c1; i++) {
      this.features.push(makeFeature(nodeId, v1, `${v1}-f${i}.feature`));
    }
    for (let i = 0; i < c2; i++) {
      this.features.push(makeFeature(nodeId, v2, `${v2}-f${i}.feature`));
    }
    for (let i = 0; i < c3; i++) {
      this.features.push(makeFeature(nodeId, v3, `${v3}-f${i}.feature`));
    }
  }
);

Given(
  'component {string} has {int} {string} features and {int} {string} features',
  function (this: RetrievalWorld, nodeId: string, c1: number, v1: string, c2: number, v2: string) {
    ensureComponent(this, nodeId);
    for (let i = 0; i < c1; i++) {
      this.features.push(makeFeature(nodeId, v1, `${v1}-f${i}.feature`));
    }
    for (let i = 0; i < c2; i++) {
      this.features.push(makeFeature(nodeId, v2, `${v2}-f${i}.feature`));
    }
  }
);

Given(
  'component {string} has feature {string} under version {string} only',
  function (this: RetrievalWorld, nodeId: string, filename: string, version: string) {
    ensureComponent(this, nodeId);
    this.features.push(makeFeature(nodeId, version, filename));
  }
);

Given(
  'component {string} has {int} features under version {string}',
  function (this: RetrievalWorld, nodeId: string, count: number, version: string) {
    ensureComponent(this, nodeId);
    for (let i = 0; i < count; i++) {
      this.features.push(makeFeature(nodeId, version, `${version}-feat-${i}.feature`));
    }
  }
);

// ─── Then ───────────────────────────────────────────────────────────

Then(
  'the response body is an array of {int} feature objects',
  function (this: RetrievalWorld, count: number) {
    assert.ok(this.response, 'No response');
    const body = this.response.body;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    assert.strictEqual(
      (body as unknown[]).length,
      count,
      `Expected ${count} features, got ${(body as unknown[]).length}`
    );
  }
);

Then(
  'each object has fields: filename, version, title, content, step_count, updated_at',
  function (this: RetrievalWorld) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body), 'Expected array');
    const required = ['filename', 'version', 'title', 'content', 'step_count', 'updated_at'];
    for (const item of body) {
      for (const field of required) {
        assert.ok(field in item, `Missing field "${field}" in feature object`);
      }
    }
  }
);

Then(
  'the response body is an array of {int} features',
  function (this: RetrievalWorld, count: number) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Record<string, unknown>;
    const features = body.features ?? body;
    assert.ok(Array.isArray(features), `Expected features array, got ${typeof features}`);
    assert.strictEqual(
      (features as unknown[]).length,
      count,
      `Expected ${count} features, got ${(features as unknown[]).length}`
    );
  }
);

Then('every feature has version {string}', function (this: RetrievalWorld, version: string) {
  assert.ok(this.response, 'No response');
  const body = this.response.body as Record<string, unknown>;
  const features = (body.features ?? body) as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(features), 'Expected array');
  for (const item of features) {
    assert.strictEqual(
      item.version,
      version,
      `Expected version "${version}", got "${item.version}"`
    );
  }
});

Then(
  'the response body has field {string} containing the full Gherkin text',
  function (this: RetrievalWorld, field: string) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Record<string, unknown>;
    const value = body[field];
    assert.ok(typeof value === 'string', `Expected "${field}" to be a string`);
    assert.ok(
      (value as string).includes('Feature:'),
      'Expected Gherkin content with Feature: line'
    );
  }
);

Then('the response content type is {string}', function (this: RetrievalWorld, contentType: string) {
  assert.ok(this.response, 'No response');
  const ct = this.response.headers['content-type'] ?? '';
  assert.ok(ct.includes(contentType), `Expected content type "${contentType}", got "${ct}"`);
});

Then('the response body is the raw Gherkin text', function (this: RetrievalWorld) {
  assert.ok(this.response, 'No response');
  const body = this.response.body;
  assert.ok(typeof body === 'string', `Expected raw text, got ${typeof body}`);
  assert.ok((body as string).includes('Feature:'), 'Expected Gherkin content with Feature: line');
});

Then(
  'each feature object has field {string} as a positive integer',
  function (this: RetrievalWorld, field: string) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Record<string, unknown>;
    const features = (body as Record<string, unknown>).features ?? body;
    assert.ok(Array.isArray(features), 'Expected features array');
    for (const item of features as Array<Record<string, unknown>>) {
      const val = item[field];
      assert.ok(
        typeof val === 'number' && Number.isInteger(val) && val > 0,
        `Expected "${field}" to be a positive integer, got ${val}`
      );
    }
  }
);

Then(
  'the response includes a {string} field with:',
  function (
    this: RetrievalWorld,
    field: string,
    dataTable: { hashes: () => Array<{ field: string }> }
  ) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Record<string, unknown>;
    const totals = body[field] as Record<string, unknown> | undefined;
    assert.ok(totals && typeof totals === 'object', `Expected "${field}" object in response`);
    const expectedFields = dataTable.hashes().map(row => row.field);
    for (const f of expectedFields) {
      assert.ok(f in totals, `Missing field "${f}" in totals`);
      assert.ok(
        typeof totals[f] === 'number',
        `Expected "${f}" to be a number, got ${typeof totals[f]}`
      );
    }
  }
);
