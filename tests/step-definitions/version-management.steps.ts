import { strict as assert } from 'node:assert';

import { Given, Then } from '@cucumber/cucumber';

import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';

interface VersionWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

// ─── Helpers ────────────────────────────────────────────────────────

function ensureComponent(world: VersionWorld, compId: string): void {
  if (!world.nodes) {
    world.nodes = [];
  }
  if (!world.edges) {
    world.edges = [];
  }
  if (!world.versions) {
    world.versions = [];
  }
  if (!world.features) {
    world.features = [];
  }
  const layerId = 'supervisor-layer';
  if (!world.nodes.some(n => n.id === layerId)) {
    world.nodes.push(new Node({ id: layerId, name: 'Supervisor Layer', type: 'layer' }));
  }
  if (!world.nodes.some(n => n.id === compId)) {
    world.nodes.push(new Node({ id: compId, name: compId, type: 'component', layer: layerId }));
    const nextId = world.edges.length > 0 ? Math.max(...world.edges.map(e => e.id ?? 0)) + 1 : 1;
    world.edges.push(
      new Edge({ id: nextId, source_id: layerId, target_id: compId, type: 'CONTAINS' })
    );
  }
}

function addVersion(world: VersionWorld, nodeId: string, ver: string, progress = 0): void {
  if (!world.versions) {
    world.versions = [];
  }
  world.versions = world.versions.filter(v => !(v.node_id === nodeId && v.version === ver));
  world.versions.push(new Version({ node_id: nodeId, version: ver, progress, status: 'planned' }));
}

// ─── Given ──────────────────────────────────────────────────────────

Given(
  'component {string} has versions {string}, {string}, {string}, {string}',
  function (this: VersionWorld, compId: string, v1: string, v2: string, v3: string, v4: string) {
    ensureComponent(this, compId);
    for (const ver of [v1, v2, v3, v4]) {
      addVersion(this, compId, ver);
    }
  }
);

Given(
  'component {string} has versions {string}, {string}, {string}',
  function (this: VersionWorld, compId: string, v1: string, v2: string, v3: string) {
    ensureComponent(this, compId);
    for (const ver of [v1, v2, v3]) {
      addVersion(this, compId, ver);
    }
  }
);

Given(
  'component {string} has version {string} with progress {int}',
  function (this: VersionWorld, compId: string, ver: string, progress: number) {
    ensureComponent(this, compId);
    addVersion(this, compId, ver, progress);
  }
);

Given(
  'component {string} has version {string} with {int} total steps and {int} passing',
  function (
    this: VersionWorld,
    compId: string,
    ver: string,
    totalSteps: number,
    passingSteps: number
  ) {
    ensureComponent(this, compId);
    addVersion(this, compId, ver);
    // Add features with the specified step counts to simulate step-based progress.
    // passing_steps are tracked via a separate mechanism; we add features whose
    // step_count totals to totalSteps, and store passingSteps on the world.
    if (!this.features) {
      this.features = [];
    }
    this.features.push(
      new Feature({
        node_id: compId,
        version: ver,
        filename: `${ver}-steps.feature`,
        title: 'Step tracking',
        content: 'Feature: Steps\n  Scenario: S\n    Given a step',
        step_count: totalSteps,
      })
    );
    // Store passing steps count so the mock repo can return it
    const key = `passing_steps:${compId}:${ver}`;
    this[key] = passingSteps;
  }
);

// ─── Then ───────────────────────────────────────────────────────────

Then('the response body is an array of {int} items', function (this: VersionWorld, count: number) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body;
  assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
  assert.equal(
    (body as unknown[]).length,
    count,
    `Expected ${count} items, got ${(body as unknown[]).length}`
  );
});

Then(
  'each version object has fields {string}, {string}, {string}, {string}, {string}',
  function (this: VersionWorld, f1: string, f2: string, f3: string, f4: string, f5: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    const fields = [f1, f2, f3, f4, f5];
    for (const item of body) {
      for (const field of fields) {
        assert.ok(
          field in item,
          `Expected field "${field}" in version object, got keys: ${Object.keys(item).join(', ')}`
        );
      }
    }
  }
);

Then('each phase version includes step-based progress fields', function (this: VersionWorld) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
  const phaseVersions = body.filter(v => Version.isPhaseTag(String(v.version)));
  assert.ok(phaseVersions.length > 0, 'Expected at least one phase version (mvp, v1, v2)');
  for (const item of phaseVersions) {
    assert.ok('total_steps' in item, `Expected "total_steps" in phase version "${item.version}"`);
    assert.ok(
      'passing_steps' in item,
      `Expected "passing_steps" in phase version "${item.version}"`
    );
    assert.ok(
      'step_progress' in item,
      `Expected "step_progress" in phase version "${item.version}"`
    );
  }
});
