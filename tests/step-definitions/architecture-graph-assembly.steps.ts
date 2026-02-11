import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type { ArchitectureData } from '../../src/use-cases/get-architecture.js';
import { GetArchitecture } from '../../src/use-cases/get-architecture.js';
import { buildRepos } from '../helpers/build-repos.js';

interface World {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  result: ArchitectureData;
  [key: string]: unknown;
}

// ─── Background ─────────────────────────────────────────────────────

Given('a database with architecture data', function (this: World) {
  this.nodes = [];
  this.edges = [];
  this.versions = [];
  this.features = [];
});

// ─── Nodes ──────────────────────────────────────────────────────────

Given(
  'the database contains nodes of types {string}, {string}, and {string}',
  function (this: World, type1: string, type2: string, type3: string) {
    this.nodes = [
      new Node({ id: `${type1}-1`, name: `${type1} 1`, type: type1 as 'layer' }),
      new Node({ id: `${type2}-1`, name: `${type2} 1`, type: type2 as 'component' }),
      new Node({ id: `${type3}-1`, name: `${type3} 1`, type: type3 as 'store' }),
    ];
  }
);

Given('a layer node {string}', function (this: World, id: string) {
  this.nodes.push(new Node({ id, name: id, type: 'layer' }));
});

Given(
  'a component node {string} belonging to layer {string}',
  function (this: World, compId: string, layerId: string) {
    this.nodes.push(new Node({ id: compId, name: compId, type: 'component', layer: layerId }));
  }
);

Given('a component node {string}', function (this: World, id: string) {
  this.nodes.push(new Node({ id, name: id, type: 'component' }));
});

// ─── Versions ───────────────────────────────────────────────────────

Given(
  'versions {string}, {string}, {string} exist for node {string}',
  function (this: World, v1: string, v2: string, v3: string, nodeId: string) {
    for (const ver of [v1, v2, v3]) {
      this.versions.push(
        new Version({
          node_id: nodeId,
          version: ver,
          content: `Content for ${ver}`,
          progress: 0,
          status: 'planned',
        })
      );
    }
  }
);

// ─── Features ───────────────────────────────────────────────────────

Given(
  'a feature file {string} for node {string} version {string}',
  function (this: World, filename: string, nodeId: string, version: string) {
    this.features.push(
      new Feature({
        node_id: nodeId,
        version,
        filename,
        title: 'Test Feature',
        content: 'Feature: Test Feature',
      })
    );
  }
);

// ─── Edges ──────────────────────────────────────────────────────────
// Note: "a {string} edge from {string} to {string}" is defined in common.steps.ts

// ─── Stats setup ────────────────────────────────────────────────────

Given(
  'the database contains {int} nodes, {int} edges, {int} versions, and {int} feature(s)',
  function (this: World, nNodes: number, nEdges: number, nVersions: number, nFeatures: number) {
    this.nodes = [];
    this.edges = [];
    this.versions = [];
    this.features = [];

    for (let i = 0; i < nNodes; i++) {
      this.nodes.push(
        new Node({ id: `node-${i}`, name: `Node ${i}`, type: i === 0 ? 'layer' : 'component' })
      );
    }
    for (let i = 0; i < nEdges; i++) {
      this.edges.push(
        new Edge({
          id: i + 1,
          source_id: `node-0`,
          target_id: `node-${(i % (nNodes - 1)) + 1}`,
          type: 'CONTROLS',
        })
      );
    }
    for (let i = 0; i < nVersions; i++) {
      this.versions.push(
        new Version({
          node_id: `node-${i % nNodes}`,
          version: 'mvp',
          progress: 0,
          status: 'planned',
        })
      );
    }
    for (let i = 0; i < nFeatures; i++) {
      this.features.push(
        new Feature({
          node_id: `node-1`,
          version: 'mvp',
          filename: `mvp-feature-${i}.feature`,
          title: `Feature ${i}`,
        })
      );
    }
  }
);

// ─── When ───────────────────────────────────────────────────────────

When('I assemble the architecture graph', async function (this: World) {
  const repos = buildRepos(this);
  const useCase = new GetArchitecture(repos);
  this.result = await useCase.execute();
});

// ─── Then ───────────────────────────────────────────────────────────

Then('every node appears in the result', function (this: World) {
  assert.equal(this.result.nodes.length, this.nodes.length);
  for (const n of this.nodes) {
    assert.ok(
      this.result.nodes.some(rn => rn.id === n.id),
      `Node ${n.id} missing from result`
    );
  }
});

Then(
  'the layer {string} contains child {string}',
  function (this: World, layerId: string, childId: string) {
    const layer = this.result.layers.find(l => l.id === layerId);
    assert.ok(layer, `Layer ${layerId} not found`);
    assert.ok(
      layer.children.some(c => c.id === childId),
      `Child ${childId} not in layer ${layerId}`
    );
  }
);

Then(
  'node {string} has version keys {string}, {string}, {string}',
  function (this: World, nodeId: string, v1: string, v2: string, v3: string) {
    const node = this.result.nodes.find(n => n.id === nodeId);
    assert.ok(node, `Node ${nodeId} not found`);
    for (const v of [v1, v2, v3]) {
      assert.ok(v in node.versions, `Version ${v} missing from node ${nodeId}`);
    }
  }
);

Then('each version includes content, progress, and status', function (this: World) {
  for (const node of this.result.nodes) {
    for (const ver of Object.values(node.versions)) {
      assert.ok('content' in ver);
      assert.ok('progress' in ver);
      assert.ok('status' in ver);
    }
  }
});

Then(
  'node {string} has features under version {string}',
  function (this: World, nodeId: string, version: string) {
    const node = this.result.nodes.find(n => n.id === nodeId);
    assert.ok(node, `Node ${nodeId} not found`);
    assert.ok(node.features[version], `No features for version ${version}`);
    assert.ok(node.features[version].length > 0, `Features array is empty for ${version}`);
  }
);

Then('the feature includes filename and title', function (this: World) {
  for (const node of this.result.nodes) {
    for (const feats of Object.values(node.features)) {
      for (const f of feats) {
        assert.ok('filename' in f);
        assert.ok('title' in f);
      }
    }
  }
});

Then('the edges list includes the {string} edge', function (this: World, type: string) {
  assert.ok(
    this.result.edges.some(e => e.type === type),
    `No ${type} edge in result`
  );
});

Then('the edges list does not include the {string} edge', function (this: World, type: string) {
  assert.ok(!this.result.edges.some(e => e.type === type), `${type} edge should not be in result`);
});

Then('the stats report {int} total nodes', function (this: World, count: number) {
  assert.equal(this.result.stats.total_nodes, count);
});

Then('the stats report {int} total edges', function (this: World, count: number) {
  assert.equal(this.result.stats.total_edges, count);
});

Then('the stats report {int} total versions', function (this: World, count: number) {
  assert.equal(this.result.stats.total_versions, count);
});

Then('the stats report {int} total feature(s)', function (this: World, count: number) {
  assert.equal(this.result.stats.total_features, count);
});

Then('the result includes a {string} ISO timestamp', function (this: World, field: string) {
  const value = this.result[field as keyof ArchitectureData];
  assert.ok(value, `Field ${field} missing`);
  assert.ok(typeof value === 'string', `Field ${field} should be a string`);
  assert.ok(!isNaN(Date.parse(value as string)), `Field ${field} is not a valid ISO date`);
});
