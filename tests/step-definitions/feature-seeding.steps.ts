import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import type { IFeatureRepository } from '../../src/domain/repositories/feature-repository.js';
import type { INodeRepository } from '../../src/domain/repositories/node-repository.js';
import type { FeatureFileInput } from '../../src/use-cases/seed-features.js';
import { SeedFeatures } from '../../src/use-cases/seed-features.js';

interface World {
  nodes: Node[];
  featureInputs: FeatureFileInput[];
  savedFeatures: Feature[];
  deleteAllCalled: boolean;
  seedResult: { seeded: number; skipped: number };
  existingFeatures: Feature[];
}

function buildRepos(world: World) {
  const nodeRepo: INodeRepository = {
    findAll: async () => world.nodes,
    findById: async (id: string) => world.nodes.find(n => n.id === id) ?? null,
    findByType: async () => [],
    findByLayer: async () => [],
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async () => {},
    delete: async () => {},
  };
  const featureRepo: IFeatureRepository = {
    findAll: async () => world.savedFeatures,
    findByNode: async (nid: string) => world.savedFeatures.filter(f => f.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.savedFeatures.filter(f => f.node_id === nid && f.version === ver),
    save: async (feature: Feature) => {
      world.savedFeatures.push(feature);
    },
    deleteAll: async () => {
      world.deleteAllCalled = true;
      world.savedFeatures = [];
    },
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
  };
  return { nodeRepo, featureRepo };
}

// ─── Given ──────────────────────────────────────────────────────────
// Note: "a component node {string} exists" and "no node with id {string} exists"
// are defined in common.steps.ts to avoid ambiguity across feature files.

Given(
  'a feature file {string} with content:',
  function (this: World, filename: string, content: string) {
    if (!this.featureInputs) {
      this.featureInputs = [];
    }
    const lastNode = this.nodes[this.nodes.length - 1];
    this.featureInputs.push({ nodeId: lastNode.id, filename, content });
  }
);

Given('a feature file targeting node {string}', function (this: World, nodeId: string) {
  if (!this.featureInputs) {
    this.featureInputs = [];
  }
  this.featureInputs.push({
    nodeId,
    filename: 'mvp-unknown.feature',
    content: 'Feature: Unknown',
  });
});

Given(
  'the database already has features for node {string}',
  function (this: World, nodeId: string) {
    if (!this.existingFeatures) {
      this.existingFeatures = [];
    }
    this.existingFeatures.push(
      new Feature({
        node_id: nodeId,
        version: 'mvp',
        filename: 'old.feature',
        title: 'Old Feature',
        content: 'Feature: Old',
      })
    );
  }
);

// ─── When ───────────────────────────────────────────────────────────

When('I seed the feature files', async function (this: World) {
  if (!this.nodes) {
    this.nodes = [];
  }
  if (!this.featureInputs) {
    this.featureInputs = [];
  }
  if (!this.savedFeatures) {
    this.savedFeatures = [];
  }
  this.deleteAllCalled = false;

  // Pre-populate savedFeatures with existing if any
  if (this.existingFeatures) {
    this.savedFeatures = [...this.existingFeatures];
  }

  const repos = buildRepos(this);
  const useCase = new SeedFeatures(repos);
  this.seedResult = await useCase.execute(this.featureInputs);
});

// ─── Then ───────────────────────────────────────────────────────────

Then(
  'the feature for node {string} is saved with version {string}',
  function (this: World, nodeId: string, version: string) {
    const found = this.savedFeatures.find(f => f.node_id === nodeId && f.version === version);
    assert.ok(found, `No feature saved for node=${nodeId} version=${version}`);
  }
);

Then('the feature title is {string}', function (this: World, title: string) {
  const last = this.savedFeatures[this.savedFeatures.length - 1];
  assert.ok(last, 'No features saved');
  assert.equal(last.title, title);
});

Then('the feature is saved with version {string}', function (this: World, version: string) {
  const last = this.savedFeatures[this.savedFeatures.length - 1];
  assert.ok(last, 'No features saved');
  assert.equal(last.version, version);
});

Then('the feature is skipped', function (this: World) {
  assert.equal(this.seedResult.skipped > 0, true, 'Expected at least one skipped feature');
});

Then(
  'the result reports {int} seeded and {int} skipped',
  function (this: World, seeded: number, skipped: number) {
    assert.equal(this.seedResult.seeded, seeded);
    assert.equal(this.seedResult.skipped, skipped);
  }
);

Then('all previous features are deleted before new ones are inserted', function (this: World) {
  assert.equal(this.deleteAllCalled, true, 'deleteAll was not called');
});
