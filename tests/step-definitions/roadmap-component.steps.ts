import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import type { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type { ArchitectureData } from '../../src/use-cases/get-architecture.js';
import { GetArchitecture } from '../../src/use-cases/get-architecture.js';
import type { FeatureFileInput } from '../../src/use-cases/seed-features.js';
import { SeedFeatures } from '../../src/use-cases/seed-features.js';
import { buildRepos } from '../helpers/build-repos.js';

interface World {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  result: ArchitectureData;
  seededFeatures: Feature[];
  seedResult: { seeded: number; skipped: number };
  [key: string]: unknown;
}

// ─── Self-tracking ───────────────────────────────────────────────────

Given('the architecture database is seeded', function (this: World) {
  this.nodes = [
    new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.1.0' }),
    new Node({ id: 'supervisor', name: 'Supervisor', type: 'app' }),
    new Node({ id: 'meta-agent', name: 'Meta-Agent', type: 'app' }),
    new Node({ id: 'worker', name: 'Worker', type: 'app' }),
    new Node({ id: 'state-store', name: 'State Store', type: 'app' }),
    new Node({ id: 'user-knowledge-graph', name: 'User KG', type: 'app' }),
    new Node({ id: 'rpg-code-graph', name: 'RPG Code Graph', type: 'app' }),
    new Node({ id: 'live-dashboard', name: 'Live Dashboard', type: 'app' }),
    new Node({ id: 'mcp-proxy-meta', name: 'MCP Proxy Meta', type: 'app' }),
    new Node({ id: 'mcp-proxy-worker', name: 'MCP Proxy Worker', type: 'app' }),
    new Node({ id: 'sanitiser', name: 'Sanitiser', type: 'app' }),
    new Node({ id: 'human-gate', name: 'Human Gate', type: 'app' }),
    new Node({ id: 'checkpointer', name: 'Checkpointer', type: 'app' }),
    new Node({ id: 'context-rebuilder', name: 'Context Rebuilder', type: 'app' }),
    new Node({ id: 'observability-dashboard', name: 'Observability Dashboard', type: 'layer' }),
    new Node({ id: 'goal-queue', name: 'goal_queue', type: 'component' }),
    new Node({ id: 'phase-feature', name: 'Feature Phase', type: 'phase' }),
    new Node({ id: 'tool-search', name: 'Search', type: 'external' }),
  ];
  this.edges = [];
  this.versions = [
    new Version({ node_id: 'roadmap', version: 'overview', content: 'Roadmap overview' }),
    new Version({ node_id: 'roadmap', version: 'mvp', content: 'Roadmap MVP' }),
  ];
  this.features = [];
});

When('I look up the node {string}', function (this: World, id: string) {
  this.foundNode = this.nodes.find(n => n.id === id) ?? null;
});

Then('it should exist with type {string}', function (this: World, type: string) {
  assert.ok(this.foundNode, 'Node not found');
  assert.equal((this.foundNode as Node).type, type);
});

Then('it should have a current_version', function (this: World) {
  assert.ok((this.foundNode as Node).current_version, 'No current_version');
});

Then('its display state should be {string}', function (this: World, expected: string) {
  assert.equal((this.foundNode as Node).displayState(), expected);
});

When('I retrieve versions for node {string}', function (this: World, id: string) {
  this.foundVersions = this.versions.filter(v => v.node_id === id);
});

Then('there should be an {string} version', function (this: World, version: string) {
  const versions = this.foundVersions as Version[];
  assert.ok(
    versions.some(v => v.version === version),
    `Version ${version} not found`
  );
});

// ─── Feature files ───────────────────────────────────────────────────

Given('feature files exist at {string}', function (this: World, _path: string) {
  // The actual feature files under components/roadmap/features/ will exist after the move
  // For this step we simulate their existence
  this.featureFilesPath = _path;
});

When('I seed features into the database', async function (this: World) {
  if (!this.nodes) {
    this.nodes = [
      new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.1.0' }),
    ];
  }
  if (!this.edges) {
    this.edges = [];
  }
  if (!this.versions) {
    this.versions = [];
  }
  if (!this.features) {
    this.features = [];
  }

  const repos = buildRepos(this, {
    featureSave: async (feature: Feature) => {
      this.features.push(feature);
    },
    featureDeleteAll: async () => {
      this.features = [];
    },
  });
  const seedFeatures = new SeedFeatures({
    featureRepo: repos.featureRepo,
    nodeRepo: repos.nodeRepo,
  });

  // Simulate feature file inputs for roadmap
  const inputs: FeatureFileInput[] = [
    {
      nodeId: 'roadmap',
      filename: 'mvp-architecture-graph-assembly.feature',
      content: 'Feature: Architecture Graph Assembly\n  Scenario: test',
    },
  ];
  this.seedResult = await seedFeatures.execute(inputs);
});

Then('features should be linked to node {string}', function (this: World, nodeId: string) {
  const linked = this.features.filter(f => f.node_id === nodeId);
  assert.ok(linked.length > 0, `No features linked to ${nodeId}`);
});

Given(
  'a feature file {string} under {string}',
  function (this: World, filename: string, _path: string) {
    this.testFeatureFilename = filename;
  }
);

Then('the feature version should be {string}', function (this: World, expected: string) {
  const version = Feature.versionFromFilename(this.testFeatureFilename as string);
  assert.equal(version, expected);
});

// ─── Progression Tree Presence ───────────────────────────────────────

Given('the architecture is assembled with progression data', async function (this: World) {
  if (!this.nodes || this.nodes.length === 0) {
    this.nodes = [
      new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.1.0' }),
    ];
  }
  if (!this.edges) {
    this.edges = [];
  }
  if (!this.versions) {
    this.versions = [];
  }
  if (!this.features) {
    this.features = [];
  }

  const repos = buildRepos(this);
  const useCase = new GetArchitecture(repos);
  this.result = await useCase.execute();
});

When('I look at the progression tree', function (this: World) {
  // progression_tree is part of result
  assert.ok(this.result.progression_tree, 'No progression_tree in result');
});

Then('{string} should be present as a node', function (this: World, id: string) {
  const tree = this.result.progression_tree;
  assert.ok(tree, 'progression_tree missing');
  assert.ok(
    tree.nodes.some((n: { id: string }) => n.id === id),
    `${id} not in progression tree`
  );
});

Then('it should show its current version', function (this: World) {
  const tree = this.result.progression_tree;
  assert.ok(tree);
  const roadmap = tree.nodes.find((n: { id: string }) => n.id === 'roadmap');
  assert.ok(roadmap, 'roadmap not in tree');
  assert.ok(roadmap.current_version, 'No current_version on roadmap');
});

// ─── App Classification ──────────────────────────────────────────────

Then(
  'the following nodes should have type {string}:',
  function (
    this: World,
    expectedType: string,
    dataTable: { hashes: () => Array<{ node_id: string }> }
  ) {
    const rows = dataTable.hashes();
    for (const row of rows) {
      const node = this.nodes.find(n => n.id === row.node_id);
      assert.ok(node, `Node ${row.node_id} not found`);
      assert.equal(
        node.type,
        expectedType,
        `Node ${row.node_id} has type ${node.type}, expected ${expectedType}`
      );
    }
  }
);

Then(
  'node {string} should have type {string}',
  function (this: World, id: string, expectedType: string) {
    const node = this.nodes.find(n => n.id === id);
    assert.ok(node, `Node ${id} not found`);
    assert.equal(node.type, expectedType);
  }
);
