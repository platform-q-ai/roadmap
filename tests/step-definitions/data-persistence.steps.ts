import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';
import Database from 'better-sqlite3';

import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import type { VersionStatus, VersionTag } from '../../src/domain/entities/version.js';
import { Version } from '../../src/domain/entities/version.js';
import { SqliteEdgeRepository } from '../../src/infrastructure/sqlite/edge-repository.js';
import { SqliteFeatureRepository } from '../../src/infrastructure/sqlite/feature-repository.js';
import { SqliteNodeRepository } from '../../src/infrastructure/sqlite/node-repository.js';
import { SqliteVersionRepository } from '../../src/infrastructure/sqlite/version-repository.js';

interface World {
  db: Database.Database;
  nodeRepo: SqliteNodeRepository;
  edgeRepo: SqliteEdgeRepository;
  versionRepo: SqliteVersionRepository;
  featureRepo: SqliteFeatureRepository;
  retrievedNode: Node | null;
  retrievedNodes: Node[];
  retrievedEdges: Edge[];
  retrievedVersions: Version[];
  retrievedVersion: Version | null;
  retrievedFeatures: Feature[];
  existsResult: boolean;
  pendingVersion: Version | null;
  pendingFeature: Feature | null;
}

// ─── Background ─────────────────────────────────────────────────────

Given('a fresh in-memory SQLite database with the schema loaded', function (this: World) {
  this.db = new Database(':memory:');
  this.db.pragma('journal_mode = WAL');
  this.db.pragma('foreign_keys = ON');

  const schemaPath = join(process.cwd(), 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  this.db.exec(schema);

  this.nodeRepo = new SqliteNodeRepository(this.db);
  this.edgeRepo = new SqliteEdgeRepository(this.db);
  this.versionRepo = new SqliteVersionRepository(this.db);
  this.featureRepo = new SqliteFeatureRepository(this.db);
});

// ─── Node operations ────────────────────────────────────────────────

Given(
  'a node with id {string}, name {string}, and type {string}',
  async function (this: World, id: string, name: string, type: string) {
    const node = new Node({ id, name, type: type as 'component' });
    await this.nodeRepo.save(node);
  }
);

Given('a saved layer node {string}', async function (this: World, id: string) {
  await this.nodeRepo.save(new Node({ id, name: id, type: 'layer' }));
});

Given(
  'a saved component node {string} in layer {string}',
  async function (this: World, id: string, layerId: string) {
    await this.nodeRepo.save(new Node({ id, name: id, type: 'component', layer: layerId }));
  }
);

Given('a saved component node {string}', async function (this: World, id: string) {
  await this.nodeRepo.save(new Node({ id, name: id, type: 'component' }));
});

When('I save the node via the repository', function () {
  // Already saved in the Given step
});

When('I find the node by id {string}', async function (this: World, id: string) {
  this.retrievedNode = await this.nodeRepo.findById(id);
});

When('I find nodes by type {string}', async function (this: World, type: string) {
  this.retrievedNodes = await this.nodeRepo.findByType(type);
});

When('I find nodes by layer {string}', async function (this: World, layerId: string) {
  this.retrievedNodes = await this.nodeRepo.findByLayer(layerId);
});

When('I check if node {string} exists', async function (this: World, id: string) {
  this.existsResult = await this.nodeRepo.exists(id);
});

When('I delete node {string}', async function (this: World, id: string) {
  await this.nodeRepo.delete(id);
});

Then('the retrieved node has name {string}', function (this: World, name: string) {
  assert.ok(this.retrievedNode, 'Node was not retrieved');
  assert.equal(this.retrievedNode.name, name);
});

Then('I receive {int} nodes', function (this: World, count: number) {
  assert.equal(this.retrievedNodes.length, count);
});

Then('the result is true', function (this: World) {
  assert.equal(this.existsResult, true);
});

Then('the result is false', function (this: World) {
  assert.equal(this.existsResult, false);
});

Then('the retrieved node is null', function (this: World) {
  assert.equal(this.retrievedNode, null);
});

// ─── Edge operations ────────────────────────────────────────────────

Given('saved nodes {string} and {string}', async function (this: World, id1: string, id2: string) {
  await this.nodeRepo.save(new Node({ id: id1, name: id1, type: 'component' }));
  await this.nodeRepo.save(new Node({ id: id2, name: id2, type: 'component' }));
});

Given(
  'saved nodes {string} and {string} and {string}',
  async function (this: World, id1: string, id2: string, id3: string) {
    await this.nodeRepo.save(new Node({ id: id1, name: id1, type: 'layer' }));
    await this.nodeRepo.save(new Node({ id: id2, name: id2, type: 'component' }));
    await this.nodeRepo.save(new Node({ id: id3, name: id3, type: 'component' }));
  }
);

Given(
  'an edge from {string} to {string} of type {string}',
  async function (this: World, source: string, target: string, type: string) {
    const edge = new Edge({ source_id: source, target_id: target, type: type as 'CONTROLS' });
    await this.edgeRepo.save(edge);
  }
);

Given(
  'a saved {string} edge from {string} to {string}',
  async function (this: World, type: string, source: string, target: string) {
    const edge = new Edge({ source_id: source, target_id: target, type: type as 'CONTAINS' });
    await this.edgeRepo.save(edge);
  }
);

When('I save the edge via the repository', function () {
  // Already saved in Given step
});

When('I find edges by source {string}', async function (this: World, sourceId: string) {
  this.retrievedEdges = await this.edgeRepo.findBySource(sourceId);
});

When('I find relationship edges', async function (this: World) {
  this.retrievedEdges = await this.edgeRepo.findRelationships();
});

Then(
  'I receive {int} edge with target {string}',
  function (this: World, count: number, target: string) {
    assert.equal(this.retrievedEdges.length, count);
    if (count > 0) {
      assert.equal(this.retrievedEdges[0].target_id, target);
    }
  }
);

Then('I receive only the {string} edge', function (this: World, type: string) {
  assert.equal(this.retrievedEdges.length, 1);
  assert.equal(this.retrievedEdges[0].type, type);
});

// ─── Version operations ─────────────────────────────────────────────

Given(
  'a version {string} for node {string} with progress {int} and status {string}',
  function (this: World, version: string, nodeId: string, progress: number, status: string) {
    // Will be saved in the When step
    this.retrievedVersion = null;
    const ver = new Version({
      node_id: nodeId,
      version: version as VersionTag,
      progress,
      status: status as VersionStatus,
    });
    // Store for saving
    this.pendingVersion = ver;
  }
);

Given(
  'a saved version {string} for node {string}',
  async function (this: World, version: string, nodeId: string) {
    const ver = new Version({
      node_id: nodeId,
      version: version as VersionTag,
      progress: 0,
      status: 'planned',
    });
    await this.versionRepo.save(ver);
  }
);

When('I save the version via the repository', async function (this: World) {
  await this.versionRepo.save(this.pendingVersion!);
});

When('I find versions by node {string}', async function (this: World, nodeId: string) {
  this.retrievedVersions = await this.versionRepo.findByNode(nodeId);
});

When(
  'I update progress for node {string} version {string} to {int} with status {string}',
  async function (this: World, nodeId: string, version: string, progress: number, status: string) {
    await this.versionRepo.updateProgress(
      nodeId,
      version as VersionTag,
      progress,
      status as VersionStatus
    );
  }
);

When(
  'I find the version for node {string} version {string}',
  async function (this: World, nodeId: string, version: string) {
    this.retrievedVersion = await this.versionRepo.findByNodeAndVersion(
      nodeId,
      version as VersionTag
    );
  }
);

Then(
  'I receive {int} version with progress {int}',
  function (this: World, count: number, progress: number) {
    assert.equal(this.retrievedVersions.length, count);
    if (count > 0) {
      assert.equal(this.retrievedVersions[0].progress, progress);
    }
  }
);

Then(
  'the version has progress {int} and status {string}',
  function (this: World, progress: number, status: string) {
    assert.ok(this.retrievedVersion, 'Version was not retrieved');
    assert.equal(this.retrievedVersion.progress, progress);
    assert.equal(this.retrievedVersion.status, status);
  }
);

// ─── Feature operations ─────────────────────────────────────────────

Given(
  'a feature for node {string} version {string} with filename {string}',
  function (this: World, nodeId: string, version: string, filename: string) {
    this.pendingFeature = new Feature({
      node_id: nodeId,
      version,
      filename,
      title: filename.replace('.feature', ''),
      content: `Feature: ${filename}`,
    });
  }
);

Given(
  '{int} saved features for node {string}',
  async function (this: World, count: number, nodeId: string) {
    for (let i = 0; i < count; i++) {
      await this.featureRepo.save(
        new Feature({
          node_id: nodeId,
          version: 'mvp',
          filename: `mvp-feat-${i}.feature`,
          title: `Feature ${i}`,
          content: `Feature: Feature ${i}`,
        })
      );
    }
  }
);

When('I save the feature via the repository', async function (this: World) {
  await this.featureRepo.save(this.pendingFeature!);
});

When('I find features by node {string}', async function (this: World, nodeId: string) {
  this.retrievedFeatures = await this.featureRepo.findByNode(nodeId);
});

When('I delete all features', async function (this: World) {
  await this.featureRepo.deleteAll();
});

Then(
  'I receive {int} feature with filename {string}',
  function (this: World, count: number, filename: string) {
    assert.equal(this.retrievedFeatures.length, count);
    if (count > 0) {
      assert.equal(this.retrievedFeatures[0].filename, filename);
    }
  }
);

Then('I receive {int} features', function (this: World, count: number) {
  assert.equal(this.retrievedFeatures.length, count);
});
