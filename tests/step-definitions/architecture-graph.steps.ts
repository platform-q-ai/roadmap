import { strict as assert } from 'node:assert';

import { Given, Then } from '@cucumber/cucumber';

import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';

interface ApiWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

// ─── Given steps ────────────────────────────────────────────────────

Given('the database has a complete architecture graph', function (this: ApiWorld) {
  const layer = new Node({ id: 'supervisor-layer', name: 'Supervisor Layer', type: 'layer' });
  const comp = new Node({
    id: 'worker',
    name: 'Worker',
    type: 'component',
    layer: 'supervisor-layer',
  });
  const appNode = new Node({
    id: 'cli-app',
    name: 'CLI App',
    type: 'app',
    layer: 'supervisor-layer',
  });
  const appNode2 = new Node({
    id: 'web-app',
    name: 'Web App',
    type: 'app',
    layer: 'supervisor-layer',
  });

  // Deduplicate: remove any pre-existing nodes with these IDs
  const seedIds = new Set(['supervisor-layer', 'worker', 'cli-app', 'web-app']);
  this.nodes = this.nodes.filter(n => !seedIds.has(n.id));
  this.nodes.push(layer, comp, appNode, appNode2);

  this.edges.push(
    new Edge({ id: 10, source_id: 'supervisor-layer', target_id: 'worker', type: 'CONTAINS' }),
    new Edge({ id: 11, source_id: 'supervisor-layer', target_id: 'cli-app', type: 'CONTAINS' }),
    new Edge({ id: 12, source_id: 'supervisor-layer', target_id: 'web-app', type: 'CONTAINS' }),
    new Edge({ id: 13, source_id: 'worker', target_id: 'cli-app', type: 'DEPENDS_ON' }),
    new Edge({ id: 14, source_id: 'cli-app', target_id: 'web-app', type: 'DEPENDS_ON' })
  );

  this.versions.push(
    new Version({ node_id: 'worker', version: 'mvp', progress: 50, status: 'in-progress' }),
    new Version({ node_id: 'cli-app', version: 'mvp', progress: 30, status: 'in-progress' })
  );

  this.features.push(
    new Feature({
      node_id: 'worker',
      version: 'mvp',
      filename: 'mvp-exec.feature',
      title: 'Execution',
      content: 'Feature: Exec\n  Scenario: Run\n    Given something',
    })
  );
});

Given('component {string} has versions and features', function (this: ApiWorld, compId: string) {
  if (!this.nodes.some(n => n.id === compId)) {
    this.nodes.push(
      new Node({ id: compId, name: compId, type: 'component', layer: 'supervisor-layer' })
    );
  }
  this.versions.push(
    new Version({ node_id: compId, version: 'mvp', progress: 40, status: 'in-progress' })
  );
  this.features.push(
    new Feature({
      node_id: compId,
      version: 'mvp',
      filename: 'mvp-test.feature',
      title: 'Test Feature',
      content: 'Feature: Test\n  Scenario: T\n    Given something',
    })
  );
});

Given(
  'component {string} has current_version {string}',
  function (this: ApiWorld, compId: string, currentVersion: string) {
    this.nodes = this.nodes.filter(n => n.id !== compId);
    this.nodes.push(
      new Node({
        id: compId,
        name: compId,
        type: 'component',
        layer: 'supervisor-layer',
        current_version: currentVersion,
      })
    );
    if (!this.versions.some(v => v.node_id === compId && v.version === 'mvp')) {
      this.versions.push(
        new Version({ node_id: compId, version: 'mvp', progress: 0, status: 'planned' })
      );
    }
  }
);

// ─── Then steps ─────────────────────────────────────────────────────

Then(
  'the response body has field {string} as an ISO 8601 timestamp',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found in response body`);
    const value = String(body[field]);
    const parsed = new Date(value);
    assert.ok(!isNaN(parsed.getTime()), `Field "${field}" is not a valid timestamp: ${value}`);
    assert.strictEqual(parsed.toISOString(), value, `Field "${field}" not ISO 8601: ${value}`);
  }
);

Then(
  'the response body has field {string} as a non-empty array',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found in response body`);
    assert.ok(Array.isArray(body[field]), `Expected "${field}" to be an array`);
    assert.ok((body[field] as unknown[]).length > 0, `Expected "${field}" to be non-empty`);
  }
);

Then(
  'the stats field has {string} matching the actual node count',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const stats = body['stats'] as Record<string, number>;
    const nodes = body['nodes'] as unknown[];
    assert.ok(stats && nodes, 'stats or nodes field not found');
    assert.strictEqual(stats[field], nodes.length);
  }
);

Then(
  'the stats field has {string} matching the actual edge count',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const stats = body['stats'] as Record<string, number>;
    const responseEdges = body['edges'] as unknown[];
    const layers = body['layers'] as Array<{ children: unknown[] }>;
    assert.ok(stats && responseEdges && layers, 'stats, edges, or layers not found');
    // body.edges excludes CONTAINS; reconstruct CONTAINS count from layer children
    const containsCount = layers.reduce((sum, l) => sum + (l.children?.length ?? 0), 0);
    assert.strictEqual(
      stats[field],
      responseEdges.length + containsCount,
      `stats.${field} should equal relationship edges (${responseEdges.length}) + containment edges (${containsCount})`
    );
  }
);

Then(
  'the stats field has {string} matching the actual version count',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const stats = body['stats'] as Record<string, number>;
    const nodes = body['nodes'] as Array<{ versions: Record<string, { progress: number }> }>;
    assert.ok(stats && nodes, 'stats or nodes not found');
    // Count versions that have real data (progress is a number) across all enriched nodes
    let versionCount = 0;
    for (const node of nodes) {
      if (node.versions) {
        for (const ver of Object.values(node.versions)) {
          if (typeof ver.progress === 'number') {
            versionCount++;
          }
        }
      }
    }
    assert.strictEqual(
      stats[field],
      versionCount,
      `stats.${field} (${stats[field]}) should match version count from enriched nodes (${versionCount})`
    );
  }
);

Then(
  'the stats field has {string} matching the actual feature count',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const stats = body['stats'] as Record<string, number>;
    const nodes = body['nodes'] as Array<{ features: Record<string, unknown[]> }>;
    assert.ok(stats && nodes, 'stats or nodes not found');
    // Count all feature items across all enriched nodes
    let featureCount = 0;
    for (const node of nodes) {
      if (node.features) {
        for (const feats of Object.values(node.features)) {
          if (Array.isArray(feats)) {
            featureCount += feats.length;
          }
        }
      }
    }
    assert.strictEqual(
      stats[field],
      featureCount,
      `stats.${field} (${stats[field]}) should match feature count from enriched nodes (${featureCount})`
    );
  }
);

function assertNodeHasField(world: ApiWorld, nodeId: string, field: string): void {
  assert.ok(world.response, 'No response received');
  const body = world.response.body as Record<string, unknown>;
  const nodes = body['nodes'] as Array<Record<string, unknown>>;
  assert.ok(nodes, 'nodes field not found in response');
  const node = nodes.find(n => n['id'] === nodeId);
  assert.ok(node, `Node "${nodeId}" not found in response nodes`);
  assert.ok(field in node, `Field "${field}" not found in node "${nodeId}"`);
}

Then(
  'the node {string} in the response has field {string}',
  function (this: ApiWorld, nodeId: string, field: string) {
    assertNodeHasField(this, nodeId, field);
  }
);

Then(
  'the node {string} has field {string}',
  function (this: ApiWorld, nodeId: string, field: string) {
    assertNodeHasField(this, nodeId, field);
  }
);

Then(
  'every node in the progression_tree has type {string}',
  function (this: ApiWorld, expectedType: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const tree = body['progression_tree'] as Record<string, unknown>;
    assert.ok(tree, 'progression_tree field not found');
    const nodes = tree['nodes'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(nodes), 'progression_tree.nodes is not an array');
    for (const node of nodes) {
      assert.strictEqual(node['type'], expectedType);
    }
  }
);

Then(
  'no edge in the progression_tree has type {string}',
  function (this: ApiWorld, excludedType: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const tree = body['progression_tree'] as Record<string, unknown>;
    assert.ok(tree, 'progression_tree field not found');
    const edges = tree['edges'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(edges), 'progression_tree.edges is not an array');
    for (const edge of edges) {
      assert.notStrictEqual(
        edge['type'],
        excludedType,
        `Found edge with excluded type "${excludedType}"`
      );
    }
  }
);

Then(
  'the version {string} for node {string} has progress {int} in the response',
  function (this: ApiWorld, versionTag: string, nodeId: string, expectedProgress: number) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const nodes = body['nodes'] as Array<Record<string, unknown>>;
    assert.ok(nodes, 'nodes field not found');
    const node = nodes.find(n => n['id'] === nodeId);
    assert.ok(node, `Node "${nodeId}" not found`);
    const versions = node['versions'] as Record<string, Record<string, unknown>>;
    assert.ok(versions, `Node "${nodeId}" has no versions`);
    const version = versions[versionTag];
    assert.ok(version, `Version "${versionTag}" not found for "${nodeId}"`);
    assert.strictEqual(version['progress'], expectedProgress);
  }
);
