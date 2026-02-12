import { strict as assert } from 'node:assert';

import { Given, Then } from '@cucumber/cucumber';

import { Feature, Node } from '../../src/domain/index.js';

interface SearchWorld {
  nodes: Node[];
  edges: unknown[];
  versions: unknown[];
  features: Feature[];
  server: unknown;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

function ensureComponent(world: SearchWorld, id: string): void {
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

function makeFeatureWithContent(
  nodeId: string,
  version: string,
  filename: string,
  content: string
): Feature {
  return new Feature({
    node_id: nodeId,
    version,
    filename,
    title: Feature.titleFromContent(content, filename),
    content,
    step_count: Feature.countSteps(content),
  });
}

// ─── Given steps ────────────────────────────────────────────────────

Given('features exist containing the word {string}', function (this: SearchWorld, word: string) {
  ensureComponent(this, 'search-comp');
  const content = `Feature: Test ${word}\n  Scenario: S1\n    Given ${word} is configured\n    When action\n    Then result`;
  this.features.push(makeFeatureWithContent('search-comp', 'v1', 'v1-search.feature', content));
});

Given('a feature contains {string}', function (this: SearchWorld, text: string) {
  ensureComponent(this, 'search-comp');
  const content = `Feature: Contains ${text}\n  Scenario: S1\n    Given ${text} is set up\n    When action\n    Then result`;
  this.features.push(makeFeatureWithContent('search-comp', 'v1', 'v1-contains.feature', content));
});

Given(
  'searchable features exist for versions {string} and {string}',
  function (this: SearchWorld, ver1: string, ver2: string) {
    ensureComponent(this, 'search-comp');
    const c1 = `Feature: Searchable ${ver1}\n  Scenario: S1\n    Given searchable setup\n    When action\n    Then result`;
    const c2 = `Feature: Searchable ${ver2}\n  Scenario: S1\n    Given searchable setup\n    When action\n    Then result`;
    this.features.push(
      makeFeatureWithContent('search-comp', ver1, `${ver1}-searchable.feature`, c1)
    );
    this.features.push(
      makeFeatureWithContent('search-comp', ver2, `${ver2}-searchable.feature`, c2)
    );
  }
);

// ─── Then steps ─────────────────────────────────────────────────────

Then('the response body is an array of matching features', function (this: SearchWorld) {
  assert.ok(this.response, 'No response');
  const body = this.response.body;
  assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
  assert.ok((body as unknown[]).length > 0, 'Expected at least one matching feature in the array');
});

Then(
  'each result has fields: node_id, filename, version, title, step_count, snippet',
  function (this: SearchWorld) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body) && body.length > 0, 'Expected non-empty array');
    const requiredFields = ['node_id', 'filename', 'version', 'title', 'step_count', 'snippet'];
    for (const item of body) {
      for (const field of requiredFields) {
        assert.ok(field in item, `Missing field "${field}" in result: ${JSON.stringify(item)}`);
      }
    }
  }
);

Then('the response body contains the matching feature', function (this: SearchWorld) {
  assert.ok(this.response, 'No response');
  const body = this.response.body;
  assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
  assert.ok(
    (body as unknown[]).length > 0,
    'Expected at least one result for case-insensitive match'
  );
});

Then(
  'every result in the response has version {string}',
  function (this: SearchWorld, version: string) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body), 'Expected array');
    for (const item of body) {
      assert.strictEqual(
        item.version,
        version,
        `Expected version "${version}", got "${String(item.version)}"`
      );
    }
  }
);

Then(
  'each result has a {string} field showing context around the match',
  function (this: SearchWorld, field: string) {
    assert.ok(this.response, 'No response');
    const body = this.response.body as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body) && body.length > 0, 'Expected non-empty array');
    for (const item of body) {
      assert.ok(field in item, `Missing "${field}" field`);
      const snippet = String(item[field]);
      assert.ok(snippet.length > 0, 'Snippet should not be empty');
    }
  }
);

Then('no result contains the {string} field', function (this: SearchWorld, field: string) {
  assert.ok(this.response, 'No response');
  const body = this.response.body as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(body), 'Expected array');
  for (const item of body) {
    assert.ok(
      !(field in item),
      `Result should not contain "${field}" field but does: ${JSON.stringify(item)}`
    );
  }
});
