import { strict as assert } from 'node:assert';
import http from 'node:http';

import { Given, Then, When } from '@cucumber/cucumber';

import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';

interface FeatureDeletionWorld {
  nodes: Node[];
  edges: unknown[];
  versions: Version[];
  features: Feature[];
  server: http.Server | null;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

function ensureComponent(world: FeatureDeletionWorld, id: string): void {
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

function makeFeature(
  nodeId: string,
  version: string,
  filename: string,
  stepCount: number
): Feature {
  const content = `Feature: ${filename}\n  Scenario: S\n    Given a step`;
  return new Feature({
    node_id: nodeId,
    version,
    filename,
    title: Feature.titleFromContent(content, filename),
    content,
    step_count: stepCount,
  });
}

// ─── Given ──────────────────────────────────────────────────────────

Given(
  'component {string} has feature {string} under version {string}',
  function (this: FeatureDeletionWorld, nodeId: string, filename: string, version: string) {
    ensureComponent(this, nodeId);
    this.features.push(makeFeature(nodeId, version, filename, 1));
  }
);

Given(
  'component {string} has {int} {string} and {int} {string} features',
  function (
    this: FeatureDeletionWorld,
    nodeId: string,
    count1: number,
    ver1: string,
    count2: number,
    ver2: string
  ) {
    ensureComponent(this, nodeId);
    for (let i = 0; i < count1; i++) {
      this.features.push(makeFeature(nodeId, ver1, `${ver1}-feat-${i}.feature`, 1));
    }
    for (let i = 0; i < count2; i++) {
      this.features.push(makeFeature(nodeId, ver2, `${ver2}-feat-${i}.feature`, 1));
    }
  }
);

Given(
  'component {string} has features under {string}, {string}, and {string}',
  function (this: FeatureDeletionWorld, nodeId: string, ver1: string, ver2: string, ver3: string) {
    ensureComponent(this, nodeId);
    for (const ver of [ver1, ver2, ver3]) {
      this.features.push(makeFeature(nodeId, ver, `${ver}-test.feature`, 1));
    }
  }
);

Given(
  'component {string} has features under version {string} contributing to progress',
  function (this: FeatureDeletionWorld, nodeId: string, version: string) {
    ensureComponent(this, nodeId);
    this.features.push(makeFeature(nodeId, version, `${version}-progress-a.feature`, 5));
    this.features.push(makeFeature(nodeId, version, `${version}-progress-b.feature`, 3));
  }
);

// ─── When ───────────────────────────────────────────────────────────

When(
  'I delete all features for {string} version {string}',
  function (this: FeatureDeletionWorld, nodeId: string, version: string) {
    this.features = this.features.filter(f => !(f.node_id === nodeId && f.version === version));
  }
);

// ─── Then ───────────────────────────────────────────────────────────

Then(
  'the feature {string} under version {string} no longer exists for {string}',
  function (this: FeatureDeletionWorld, filename: string, version: string, nodeId: string) {
    const found = this.features.some(
      f => f.node_id === nodeId && f.version === version && f.filename === filename
    );
    assert.ok(
      !found,
      `Expected feature "${filename}" under "${version}" to not exist for "${nodeId}", but it was found`
    );
  }
);

Then(
  '{int} {string} features still exist for {string}',
  function (this: FeatureDeletionWorld, count: number, version: string, nodeId: string) {
    const matching = this.features.filter(f => f.node_id === nodeId && f.version === version);
    assert.strictEqual(
      matching.length,
      count,
      `Expected ${count} "${version}" features for "${nodeId}", found ${matching.length}`
    );
  }
);

Then(
  '{int} {string} features exist for {string}',
  function (this: FeatureDeletionWorld, count: number, version: string, nodeId: string) {
    const matching = this.features.filter(f => f.node_id === nodeId && f.version === version);
    assert.strictEqual(
      matching.length,
      count,
      `Expected ${count} "${version}" features for "${nodeId}", found ${matching.length}`
    );
  }
);

Then('no features exist for {string}', function (this: FeatureDeletionWorld, nodeId: string) {
  const matching = this.features.filter(f => f.node_id === nodeId);
  assert.strictEqual(
    matching.length,
    0,
    `Expected no features for "${nodeId}", found ${matching.length}`
  );
});

Then(
  'the step-based progress for {string} version {string} drops to 0 percent',
  function (this: FeatureDeletionWorld, nodeId: string, version: string) {
    const matching = this.features.filter(f => f.node_id === nodeId && f.version === version);
    const totalSteps = matching.reduce((sum, f) => sum + f.step_count, 0);
    assert.strictEqual(
      totalSteps,
      0,
      `Expected 0 steps for "${nodeId}" "${version}", found ${totalSteps}`
    );
  }
);
