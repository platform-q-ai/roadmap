import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

import { Node } from '../../src/domain/entities/node.js';

interface World {
  seedSql: string;
  node: Node;
  webHtml: string;
  [key: string]: unknown;
}

const ROOT = join(import.meta.dirname, '..', '..');

// ─── Background ──────────────────────────────────────────────────────

Given('an architecture with orchestration components', function (this: World) {
  this.seedSql = readFileSync(join(ROOT, 'seed.sql'), 'utf-8');
  this.webHtml = readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');
});

// ─── Helper: find the seed.sql line containing a given node ID ───────

function seedLineForNode(seedSql: string, nodeId: string): string {
  const lines = seedSql.split('\n');
  const line = lines.find(l => l.includes(`'${nodeId}'`));
  return line ?? '';
}

// ─── Seed Data: current_version ──────────────────────────────────────

Then(
  'the seed node {string} should have current_version {string}',
  function (this: World, nodeId: string, expectedVersion: string) {
    const line = seedLineForNode(this.seedSql, nodeId);
    assert.ok(line, `Node ${nodeId} not found in seed.sql`);
    assert.ok(
      line.includes(`'${expectedVersion}'`),
      `Node ${nodeId} does not have current_version ${expectedVersion} in seed.sql`
    );
  }
);

// ─── Seed Data: color ────────────────────────────────────────────────

Then(
  'the seed node {string} should have color {string}',
  function (this: World, nodeId: string, expectedColor: string) {
    const line = seedLineForNode(this.seedSql, nodeId);
    assert.ok(line, `Node ${nodeId} not found in seed.sql`);
    assert.ok(
      line.includes(`'${expectedColor}'`),
      `Node ${nodeId} does not have color '${expectedColor}' in seed.sql`
    );
  }
);

// ─── Seed Data: tags ─────────────────────────────────────────────────

Then(
  'the seed node {string} should have tag {string}',
  function (this: World, nodeId: string, expectedTag: string) {
    const line = seedLineForNode(this.seedSql, nodeId);
    assert.ok(line, `Node ${nodeId} not found in seed.sql`);
    assert.ok(
      line.includes(`"${expectedTag}"`),
      `Node ${nodeId} does not have tag "${expectedTag}" in seed.sql`
    );
  }
);

// ─── Domain: Visual state ────────────────────────────────────────────

Given(
  'a node with current_version {string} and color {string}',
  function (this: World, version: string, color: string) {
    this.node = new Node({
      id: 'test-node',
      name: 'Test',
      type: 'app',
      current_version: version,
      color,
    });
  }
);

Then('the node visual state should be {string}', function (this: World, expected: string) {
  assert.equal(this.node.visualState(), expected);
});

// ─── Seed Data: Version records ──────────────────────────────────────

Then(
  'the seed version {string} for {string} should have progress {int}',
  function (this: World, versionTag: string, nodeId: string, expectedProgress: number) {
    // Match: ('nodeId', 'versionTag', '...content with escaped quotes...', PROGRESS, 'status')
    const versionPattern = new RegExp(
      `'${nodeId}'\\s*,\\s*'${versionTag}'\\s*,\\s*'[^']*(?:''[^']*)*'\\s*,\\s*(\\d+)\\s*,`,
      'g'
    );
    const match = versionPattern.exec(this.seedSql);
    assert.ok(match, `Version ${versionTag} for ${nodeId} not found in seed.sql`);
    const progress = parseInt(match[1], 10);
    assert.equal(
      progress,
      expectedProgress,
      `Version ${versionTag} for ${nodeId} has progress ${progress}, expected ${expectedProgress}`
    );
  }
);

Then(
  'the seed version {string} for {string} should have status {string}',
  function (this: World, versionTag: string, nodeId: string, expectedStatus: string) {
    const versionPattern = new RegExp(
      `'${nodeId}'\\s*,\\s*'${versionTag}'\\s*,\\s*'[^']*(?:''[^']*)*'\\s*,\\s*\\d+\\s*,\\s*'([^']+)'`,
      'g'
    );
    const match = versionPattern.exec(this.seedSql);
    assert.ok(match, `Version ${versionTag} for ${nodeId} not found in seed.sql`);
    assert.equal(
      match[1],
      expectedStatus,
      `Version ${versionTag} for ${nodeId} has status '${match[1]}', expected '${expectedStatus}'`
    );
  }
);

// ─── Web View: Progression tree colors ───────────────────────────────

Then(
  'the web view should define complete state color with green border {string}',
  function (this: World, expectedBorder: string) {
    assert.ok(
      this.webHtml.includes(expectedBorder),
      `Web view does not contain green border color ${expectedBorder}`
    );
    assert.ok(this.webHtml.includes(`'complete'`), 'Web view does not define a complete state');
  }
);

Then(
  'the web view should define complete state with dark green background',
  function (this: World) {
    assert.ok(
      this.webHtml.includes('#0f2a1a'),
      'Web view does not define dark green background for complete state'
    );
  }
);

// ─── Web View: Box color classes ─────────────────────────────────────

Given('a component with color {string} in the web view', function (this: World, _color: string) {
  this.testColor = _color;
});

Then('the box should use CSS class {string}', function (this: World, cssClass: string) {
  assert.ok(
    this.webHtml.includes(`.${cssClass}`),
    `Web view does not contain CSS class .${cssClass}`
  );
});

Then('the green box should have green-tinted title color', function (this: World) {
  assert.ok(
    this.webHtml.includes('.b-green .t{color:var(--green)'),
    'Web view does not have green-tinted title color for .b-green boxes'
  );
});
