import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { Node } from '../../src/domain/entities/node.js';
import type { VersionStatus, VersionTag } from '../../src/domain/entities/version.js';
import { Version } from '../../src/domain/entities/version.js';
import type { INodeRepository } from '../../src/domain/repositories/node-repository.js';
import type { IVersionRepository } from '../../src/domain/repositories/version-repository.js';
import { UpdateProgress } from '../../src/use-cases/update-progress.js';

interface World {
  nodes: Node[];
  versions: Version[];
  updateProgressCalled: boolean;
  lastUpdateArgs: { nodeId: string; version: string; progress: number; status: string } | null;
  error: Error | null;
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
  const versionRepo: IVersionRepository = {
    findAll: async () => world.versions,
    findByNode: async (nid: string) => world.versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async () => {},
    updateProgress: async (
      nodeId: string,
      version: VersionTag,
      progress: number,
      status: VersionStatus
    ) => {
      world.updateProgressCalled = true;
      world.lastUpdateArgs = { nodeId, version, progress, status };
    },
    deleteByNode: async () => {},
  };
  return { nodeRepo, versionRepo };
}

// ─── Given ──────────────────────────────────────────────────────────
// Note: "a component node {string} exists" is defined in common.steps.ts

Given(
  'a version {string} exists for node {string}',
  function (this: World, version: string, nodeId: string) {
    if (!this.versions) {
      this.versions = [];
    }
    this.versions.push(
      new Version({
        node_id: nodeId,
        version: version as VersionTag,
        progress: 0,
        status: 'planned',
      })
    );
  }
);

// ─── When ───────────────────────────────────────────────────────────

When(
  'I update progress for node {string} version {string} to {int} percent with status {string}',
  async function (this: World, nodeId: string, version: string, progress: number, status: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    if (!this.versions) {
      this.versions = [];
    }
    this.updateProgressCalled = false;
    this.lastUpdateArgs = null;
    this.error = null;

    const repos = buildRepos(this);
    const useCase = new UpdateProgress(repos);
    try {
      await useCase.execute(nodeId, version as VersionTag, progress, status as VersionStatus);
    } catch (err) {
      this.error = err as Error;
    }
  }
);

// ─── Then ───────────────────────────────────────────────────────────

Then('the version repository receives the update', function (this: World) {
  assert.equal(this.error, null, `Unexpected error: ${this.error?.message}`);
  assert.equal(this.updateProgressCalled, true, 'updateProgress was not called');
});

Then('the operation fails with error {string}', function (this: World, expectedFragment: string) {
  assert.ok(this.error, 'Expected an error but none was thrown');
  assert.ok(
    this.error.message.includes(expectedFragment),
    `Expected error containing "${expectedFragment}", got: "${this.error.message}"`
  );
});
