import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import type { Edge } from '../../src/domain/entities/edge.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type { ArchitectureData } from '../../src/use-cases/get-architecture.js';
import { GetArchitecture } from '../../src/use-cases/get-architecture.js';
import { buildRepos } from '../helpers/build-repos.js';

interface World {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: never[];
  derivedProgress: number;
  derivedStatus: string;
  result: ArchitectureData;
  [key: string]: unknown;
}

// ─── Domain: Derive phase progress from current_version ──────────────

Given('a node with current_version {string}', function (this: World, version: string) {
  this.node = new Node({
    id: 'test-node',
    name: 'Test',
    type: 'component',
    current_version: version,
  });
});

Given('a node with no current_version', function (this: World) {
  this.node = new Node({ id: 'test-node', name: 'Test', type: 'component' });
});

When('I derive phase progress for version {string}', function (this: World, versionTag: string) {
  // This calls Version.deriveProgress(currentVersion, versionTag)
  // which does not exist yet — will fail RED
  this.derivedProgress = Version.deriveProgress(this.node.current_version, versionTag);
  this.derivedStatus = Version.deriveStatus(this.derivedProgress);
});

Then('the derived progress should be {int}', function (this: World, expected: number) {
  assert.equal(this.derivedProgress, expected);
});

Then('the derived status should be {string}', function (this: World, expected: string) {
  assert.equal(this.derivedStatus, expected);
});

// ─── Use Case: GetArchitecture uses derived progress ─────────────────

Given(
  'a version {string} with manual progress {int} exists for {string}',
  function (this: World, versionTag: string, progress: number, nodeId: string) {
    if (!this.versions) {
      this.versions = [];
    }
    this.versions.push(
      new Version({
        node_id: nodeId,
        version: versionTag,
        content: 'Test content',
        progress,
        status: progress > 0 ? 'in-progress' : 'planned',
      })
    );
  }
);

Then(
  'the version {string} for node {string} should have progress {int}',
  function (this: World, versionTag: string, nodeId: string, expected: number) {
    const node = this.result.nodes.find(n => n.id === nodeId);
    assert.ok(node, `Node ${nodeId} not found in result`);
    const ver = node.versions[versionTag];
    assert.ok(ver, `Version ${versionTag} not found for node ${nodeId}`);
    assert.equal(ver.progress, expected);
  }
);

Then(
  'the version {string} for node {string} should have status {string}',
  function (this: World, versionTag: string, nodeId: string, expected: string) {
    const node = this.result.nodes.find(n => n.id === nodeId);
    assert.ok(node, `Node ${nodeId} not found in result`);
    const ver = node.versions[versionTag];
    assert.ok(ver, `Version ${versionTag} not found for node ${nodeId}`);
    assert.equal(ver.status, expected);
  }
);
