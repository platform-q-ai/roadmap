import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { Feature } from '../../src/domain/entities/feature.js';
import type { IFeatureRepository } from '../../src/domain/repositories/feature-repository.js';
import type { StepTotalsResult } from '../../src/use-cases/get-step-totals.js';
import { GetStepTotals } from '../../src/use-cases/get-step-totals.js';

interface World {
  features: Feature[];
  componentId: string;
  version: string;
  result: StepTotalsResult;
  resultsByVersion: Record<string, StepTotalsResult>;
  [key: string]: unknown;
}

function buildFeatureRepo(world: World): IFeatureRepository {
  return {
    findAll: async () => world.features,
    findByNode: async (nid: string) => world.features.filter(f => f.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.features.filter(f => f.node_id === nid && f.version === ver),
    save: async (feature: Feature) => {
      world.features.push(feature);
    },
    deleteAll: async () => {
      world.features = [];
    },
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async (nid: string, fname: string) => {
      const idx = world.features.findIndex(f => f.node_id === nid && f.filename === fname);
      if (idx >= 0) {
        world.features.splice(idx, 1);
        return true;
      }
      return false;
    },
  };
}

// ─── Given ──────────────────────────────────────────────────────────

Given(
  'component {string} has these features under version {string}:',
  function (
    this: World,
    componentId: string,
    version: string,
    table: { hashes: () => Array<{ filename: string; step_count: string }> }
  ) {
    if (!this.features) {
      this.features = [];
    }
    this.componentId = componentId;
    this.version = version;
    for (const row of table.hashes()) {
      this.features.push(
        new Feature({
          node_id: componentId,
          version,
          filename: row.filename,
          title: row.filename.replace('.feature', ''),
          step_count: parseInt(row.step_count, 10),
        })
      );
    }
  }
);

Given(
  'component {string} has:',
  function (
    this: World,
    componentId: string,
    table: { hashes: () => Array<{ version: string; total_steps: string }> }
  ) {
    if (!this.features) {
      this.features = [];
    }
    this.componentId = componentId;
    for (const row of table.hashes()) {
      const totalSteps = parseInt(row.total_steps, 10);
      // Create a single feature per version to carry the step count
      this.features.push(
        new Feature({
          node_id: componentId,
          version: row.version,
          filename: `${row.version}-placeholder.feature`,
          title: 'Placeholder',
          step_count: totalSteps,
        })
      );
    }
  }
);

Given(
  'component {string} has features under {string} but none under {string}',
  function (this: World, componentId: string, hasVersion: string, missingVersion: string) {
    if (!this.features) {
      this.features = [];
    }
    this.componentId = componentId;
    this.version = missingVersion;
    this.features.push(
      new Feature({
        node_id: componentId,
        version: hasVersion,
        filename: `${hasVersion}-existing.feature`,
        title: 'Existing',
        step_count: 10,
      })
    );
  }
);

Given(
  'component {string} has {int} total steps under version {string}',
  function (this: World, componentId: string, totalSteps: number, version: string) {
    if (!this.features) {
      this.features = [];
    }
    this.componentId = componentId;
    this.version = version;
    // Create two features to make up the total
    this.features.push(
      new Feature({
        node_id: componentId,
        version,
        filename: `${version}-existing-a.feature`,
        title: 'Existing A',
        step_count: totalSteps,
      })
    );
  }
);

Given(
  'component {string} has {int} total steps under version {string} across {int} features',
  function (
    this: World,
    componentId: string,
    totalSteps: number,
    version: string,
    featureCount: number
  ) {
    if (!this.features) {
      this.features = [];
    }
    this.componentId = componentId;
    this.version = version;
    const stepsPerFeature = Math.floor(totalSteps / featureCount);
    const remainder = totalSteps % featureCount;
    for (let i = 0; i < featureCount; i++) {
      this.features.push(
        new Feature({
          node_id: componentId,
          version,
          filename: `${version}-feature-${i}.feature`,
          title: `Feature ${i}`,
          step_count: stepsPerFeature + (i === 0 ? remainder : 0),
        })
      );
    }
  }
);

// ─── When ───────────────────────────────────────────────────────────

When(
  'I query the step totals for {string} version {string}',
  async function (this: World, componentId: string, version: string) {
    const featureRepo = buildFeatureRepo(this);
    const useCase = new GetStepTotals({ featureRepo });
    this.result = await useCase.execute(componentId, version);
  }
);

When('I query the step totals for each version', async function (this: World) {
  const featureRepo = buildFeatureRepo(this);
  const useCase = new GetStepTotals({ featureRepo });
  this.resultsByVersion = {};
  const versions = [...new Set(this.features.map(f => f.version))];
  for (const ver of versions) {
    this.resultsByVersion[ver] = await useCase.execute(this.componentId, ver);
  }
});

When(
  'a new feature with {int} steps is uploaded under version {string}',
  async function (this: World, steps: number, version: string) {
    this.features.push(
      new Feature({
        node_id: this.componentId,
        version,
        filename: `${version}-new-upload.feature`,
        title: 'New Upload',
        step_count: steps,
      })
    );
    const featureRepo = buildFeatureRepo(this);
    const useCase = new GetStepTotals({ featureRepo });
    this.result = await useCase.execute(this.componentId, version);
  }
);

When(
  'a feature with {int} steps is deleted from version {string}',
  async function (this: World, steps: number, version: string) {
    // Remove the first feature with the matching step count
    const idx = this.features.findIndex(
      f => f.node_id === this.componentId && f.version === version && f.step_count === steps
    );
    if (idx >= 0) {
      this.features.splice(idx, 1);
    }
    const featureRepo = buildFeatureRepo(this);
    const useCase = new GetStepTotals({ featureRepo });
    this.result = await useCase.execute(this.componentId, version);
  }
);

// ─── Then ───────────────────────────────────────────────────────────

Then('the total steps are {int}', function (this: World, expected: number) {
  assert.equal(this.result.totalSteps, expected);
});

Then('the feature count is {int}', function (this: World, expected: number) {
  assert.equal(this.result.featureCount, expected);
});

Then(
  'the {string} total is {int} steps',
  function (this: World, version: string, expected: number) {
    assert.ok(this.resultsByVersion[version], `No result for version ${version}`);
    assert.equal(this.resultsByVersion[version].totalSteps, expected);
  }
);

Then(
  'the total steps for {string} version {string} become {int}',
  function (this: World, componentId: string, version: string, expected: number) {
    assert.equal(this.result.totalSteps, expected);
  }
);
