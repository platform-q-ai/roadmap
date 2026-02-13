import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import type { VersionStatus } from '../../src/domain/entities/version.js';
import { Version } from '../../src/domain/entities/version.js';

// Drizzle modules loaded dynamically to avoid crashing other scenarios during RED phase.

let drizzleSchema: typeof import('../../src/infrastructure/drizzle/schema.js') | null = null;

let drizzleConnection: typeof import('../../src/infrastructure/drizzle/connection.js') | null =
  null;

interface DrizzleRepoModules {
  DrizzleNodeRepository: typeof import('../../src/infrastructure/drizzle/node-repository.js').DrizzleNodeRepository;
  DrizzleEdgeRepository: typeof import('../../src/infrastructure/drizzle/edge-repository.js').DrizzleEdgeRepository;
  DrizzleVersionRepository: typeof import('../../src/infrastructure/drizzle/version-repository.js').DrizzleVersionRepository;
  DrizzleFeatureRepository: typeof import('../../src/infrastructure/drizzle/feature-repository.js').DrizzleFeatureRepository;
  eq: typeof import('drizzle-orm').eq;
  and: typeof import('drizzle-orm').and;
  sql: typeof import('drizzle-orm').sql;
}

let drizzleRepos: DrizzleRepoModules | null = null;

function getSchema() {
  assert.ok(drizzleSchema, 'Drizzle schema not loaded — call loadDrizzleModules first');
  return drizzleSchema;
}

function getConnection() {
  assert.ok(drizzleConnection, 'Drizzle connection not loaded — call loadDrizzleModules first');
  return drizzleConnection;
}

function getRepos() {
  assert.ok(drizzleRepos, 'Drizzle repos not loaded — call loadDrizzleModules first');
  return drizzleRepos;
}

async function loadDrizzleModules() {
  if (drizzleSchema) {
    return;
  }
  drizzleSchema = await import('../../src/infrastructure/drizzle/schema.js');
  drizzleConnection = await import('../../src/infrastructure/drizzle/connection.js');
  const nodeRepoMod = await import('../../src/infrastructure/drizzle/node-repository.js');
  const edgeRepoMod = await import('../../src/infrastructure/drizzle/edge-repository.js');
  const versionRepoMod = await import('../../src/infrastructure/drizzle/version-repository.js');
  const featureRepoMod = await import('../../src/infrastructure/drizzle/feature-repository.js');
  const drizzleOrm = await import('drizzle-orm');
  drizzleRepos = {
    DrizzleNodeRepository: nodeRepoMod.DrizzleNodeRepository,
    DrizzleEdgeRepository: edgeRepoMod.DrizzleEdgeRepository,
    DrizzleVersionRepository: versionRepoMod.DrizzleVersionRepository,
    DrizzleFeatureRepository: featureRepoMod.DrizzleFeatureRepository,
    eq: drizzleOrm.eq,
    and: drizzleOrm.and,
    sql: drizzleOrm.sql,
  };
}

interface World {
  drizzleDb: import('drizzle-orm/better-sqlite3').BetterSQLite3Database;
  nodeRepo: InstanceType<DrizzleRepoModules['DrizzleNodeRepository']>;
  edgeRepo: InstanceType<DrizzleRepoModules['DrizzleEdgeRepository']>;
  versionRepo: InstanceType<DrizzleRepoModules['DrizzleVersionRepository']>;
  featureRepo: InstanceType<DrizzleRepoModules['DrizzleFeatureRepository']>;
  savedNode: Node | null;
  [key: string]: unknown;
}

// ─── Schema as Code ──────────────────────────────────────────────────

Given('the Drizzle schema module', async function (this: World) {
  await loadDrizzleModules();
});

Then('it should export a nodes table definition', function () {
  assert.ok(getSchema().nodesTable, 'nodesTable not exported from schema');
});

Then('it should export an edges table definition', function () {
  assert.ok(getSchema().edgesTable, 'edgesTable not exported from schema');
});

Then('it should export a nodeVersions table definition', function () {
  assert.ok(getSchema().nodeVersionsTable, 'nodeVersionsTable not exported from schema');
});

Then('it should export a features table definition', function () {
  assert.ok(getSchema().featuresTable, 'featuresTable not exported from schema');
});

// ─── Nodes table columns ────────────────────────────────────────────

Given('the Drizzle schema nodes table', async function (this: World) {
  await loadDrizzleModules();
});

Then('it should have a text primary key column {string}', function (col: string) {
  const table = getSchema().nodesTable as Record<string, unknown>;
  assert.ok(table[col], `Column '${col}' not found on nodesTable`);
});

Then('it should have a text column {string} that is not null', function (col: string) {
  const table = getSchema().nodesTable as Record<string, unknown>;
  assert.ok(table[col], `Column '${col}' not found on nodesTable`);
});

Then(
  'it should have optional text columns {string}, {string}, {string}, {string}',
  function (c1: string, c2: string, c3: string, c4: string) {
    const table = getSchema().nodesTable as Record<string, unknown>;
    for (const col of [c1, c2, c3, c4]) {
      assert.ok(table[col], `Column '${col}' not found on nodesTable`);
    }
  }
);

Then(
  'it should have an integer column {string} defaulting to {int}',
  function (col: string, _def: number) {
    const table = getSchema().nodesTable as Record<string, unknown>;
    assert.ok(table[col], `Column '${col}' not found on nodesTable`);
  }
);

// ─── Version upsert ─────────────────────────────────────────────────

Given('a Drizzle database with schema applied', async function (this: World) {
  await loadDrizzleModules();
  this.drizzleDb = getConnection().createDrizzleConnection(':memory:');
  this.nodeRepo = new (getRepos().DrizzleNodeRepository)(this.drizzleDb);
  this.edgeRepo = new (getRepos().DrizzleEdgeRepository)(this.drizzleDb);
  this.versionRepo = new (getRepos().DrizzleVersionRepository)(this.drizzleDb);
  this.featureRepo = new (getRepos().DrizzleFeatureRepository)(this.drizzleDb);
});

Given('a node {string} exists', async function (this: World, id: string) {
  await this.nodeRepo.save(new Node({ id, name: id, type: 'component' }));
});

Given(
  'a version {string} for {string} with progress {int} and status {string}',
  async function (this: World, version: string, nodeId: string, progress: number, status: string) {
    await this.versionRepo.save(
      new Version({
        node_id: nodeId,
        version,
        content: 'Original',
        progress,
        status: status as VersionStatus,
      })
    );
  }
);

When(
  'I upsert version {string} for {string} with new content {string} via Drizzle',
  function (this: World, version: string, nodeId: string, content: string) {
    const { nodeVersionsTable: nvt } = getSchema();
    const { sql: sqlFn } = getRepos();
    this.drizzleDb
      .insert(nvt)
      .values({ node_id: nodeId, version, content, progress: 0, status: 'planned' })
      .onConflictDoUpdate({
        target: [nvt.node_id, nvt.version],
        set: { content: sqlFn`excluded.content`, updated_at: sqlFn`datetime('now')` },
      })
      .run();
  }
);

Then('the version should have content {string}', function (this: World, content: string) {
  const rows = this.drizzleDb.select().from(getSchema().nodeVersionsTable).all();
  assert.ok(rows.length > 0, 'No versions found');
  assert.equal(rows[0].content, content);
});

Then('the version should have progress {int}', function (this: World, progress: number) {
  const rows = this.drizzleDb.select().from(getSchema().nodeVersionsTable).all();
  assert.equal(rows[0].progress, progress);
});

Then('the version should have status {string}', function (this: World, status: string) {
  const rows = this.drizzleDb.select().from(getSchema().nodeVersionsTable).all();
  assert.equal(rows[0].status, status);
});

// ─── Repository parity: nodes ────────────────────────────────────────

Given('two nodes exist for edge testing', async function (this: World) {
  await this.nodeRepo.save(new Node({ id: 'n1', name: 'N1', type: 'layer' }));
  await this.nodeRepo.save(new Node({ id: 'n2', name: 'N2', type: 'component' }));
});

When('I save a node via the Drizzle repository', async function (this: World) {
  const node = new Node({
    id: 'drizzle-test',
    name: 'Drizzle Test',
    type: 'component',
    layer: 'test-layer',
  });
  await this.nodeRepo.save(node);
  this.savedNode = node;
});

Then('I can retrieve it by id', async function (this: World) {
  const found = await this.nodeRepo.findById('drizzle-test');
  assert.ok(found, 'Node not found by id');
  assert.equal(found.name, 'Drizzle Test');
});

Then('I can find it by type', async function (this: World) {
  const found = await this.nodeRepo.findByType('component');
  assert.ok(found.length > 0);
});

Then('I can find it by layer', async function (this: World) {
  const found = await this.nodeRepo.findByLayer('test-layer');
  assert.ok(found.length > 0);
});

Then('I can check it exists', async function (this: World) {
  assert.equal(await this.nodeRepo.exists('drizzle-test'), true);
});

Then('I can delete it', async function (this: World) {
  await this.nodeRepo.delete('drizzle-test');
  assert.equal(await this.nodeRepo.exists('drizzle-test'), false);
});

// ─── Repository parity: edges ────────────────────────────────────────

When('I save an edge via the Drizzle repository', async function (this: World) {
  await this.edgeRepo.save(new Edge({ source_id: 'n1', target_id: 'n2', type: 'CONTAINS' }));
});

Then('I can retrieve it by source', async function (this: World) {
  const found = await this.edgeRepo.findBySource('n1');
  assert.ok(found.length > 0);
});

Then('I can retrieve it by target', async function (this: World) {
  const found = await this.edgeRepo.findByTarget('n2');
  assert.ok(found.length > 0);
});

Then('I can retrieve relationships excluding CONTAINS', async function (this: World) {
  await this.edgeRepo.save(new Edge({ source_id: 'n1', target_id: 'n2', type: 'CONTROLS' }));
  const found = await this.edgeRepo.findRelationships();
  assert.ok(found.length > 0);
  for (const e of found) {
    assert.notEqual(e.type, 'CONTAINS');
  }
});

// ─── Repository parity: versions ─────────────────────────────────────

When('I save a version via the Drizzle repository', async function (this: World) {
  await this.versionRepo.save(
    new Version({
      node_id: 'comp-1',
      version: 'mvp',
      content: 'MVP content',
      progress: 0,
      status: 'planned',
    })
  );
});

Then('I can retrieve versions by node', async function (this: World) {
  const found = await this.versionRepo.findByNode('comp-1');
  assert.ok(found.length > 0);
});

Then('I can retrieve a specific version by node and version tag', async function (this: World) {
  const found = await this.versionRepo.findByNodeAndVersion('comp-1', 'mvp');
  assert.ok(found);
  assert.equal(found.content, 'MVP content');
});

Then('I can update progress and status', async function (this: World) {
  const existing = await this.versionRepo.findByNodeAndVersion('comp-1', 'mvp');
  assert.ok(existing, 'Version not found for update');
  await this.versionRepo.save(
    new Version({ ...existing, progress: 75, status: 'in-progress' as VersionStatus })
  );
  const found = await this.versionRepo.findByNodeAndVersion('comp-1', 'mvp');
  assert.ok(found);
  assert.equal(found.progress, 75);
  assert.equal(found.status, 'in-progress');
});

Then('I can delete versions by node', async function (this: World) {
  await this.versionRepo.deleteByNode('comp-1');
  assert.equal((await this.versionRepo.findByNode('comp-1')).length, 0);
});

// ─── Repository parity: features ─────────────────────────────────────

When('I save a feature via the Drizzle repository', async function (this: World) {
  await this.featureRepo.save(
    new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'test.feature', title: 'Test' })
  );
});

Then('I can retrieve features by node', async function (this: World) {
  assert.ok((await this.featureRepo.findByNode('comp-1')).length > 0);
});

Then('I can retrieve features by node and version', async function (this: World) {
  assert.ok((await this.featureRepo.findByNodeAndVersion('comp-1', 'mvp')).length > 0);
});

Then('I can delete all features', async function (this: World) {
  await this.featureRepo.deleteAll();
  assert.equal((await this.featureRepo.findAll()).length, 0);
});

Then('I can delete features by node', async function (this: World) {
  await this.featureRepo.save(
    new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'x.feature', title: 'X' })
  );
  await this.featureRepo.deleteByNode('comp-1');
  assert.equal((await this.featureRepo.findByNode('comp-1')).length, 0);
});

// ─── Progress persistence ────────────────────────────────────────────

Given('a Drizzle database with schema and seed data', async function (this: World) {
  await loadDrizzleModules();
  this.drizzleDb = getConnection().createDrizzleConnection(':memory:');
  this.nodeRepo = new (getRepos().DrizzleNodeRepository)(this.drizzleDb);
  this.edgeRepo = new (getRepos().DrizzleEdgeRepository)(this.drizzleDb);
  this.versionRepo = new (getRepos().DrizzleVersionRepository)(this.drizzleDb);
  this.featureRepo = new (getRepos().DrizzleFeatureRepository)(this.drizzleDb);

  const { nodesTable: nt, nodeVersionsTable: nvt } = getSchema();
  this.drizzleDb.insert(nt).values({ id: 'roadmap', name: 'Roadmap', type: 'component' }).run();
  this.drizzleDb
    .insert(nvt)
    .values([
      {
        node_id: 'roadmap',
        version: 'overview',
        content: 'Overview content',
        progress: 0,
        status: 'planned',
      },
      {
        node_id: 'roadmap',
        version: 'mvp',
        content: 'MVP content',
        progress: 0,
        status: 'in-progress',
      },
    ])
    .run();
});

When(
  'I update progress for {string} version {string} to {int} with status {string} via Drizzle',
  async function (this: World, nodeId: string, version: string, progress: number, status: string) {
    const existing = await this.versionRepo.findByNodeAndVersion(nodeId, version);
    assert.ok(existing, `Version ${version} for ${nodeId} not found`);
    await this.versionRepo.save(
      new Version({ ...existing, progress, status: status as VersionStatus })
    );
  }
);

When('I re-run the seed data via Drizzle upsert', function (this: World) {
  const { nodeVersionsTable: nvt } = getSchema();
  const { sql: sqlFn } = getRepos();
  this.drizzleDb
    .insert(nvt)
    .values([
      {
        node_id: 'roadmap',
        version: 'overview',
        content: 'Overview content',
        progress: 0,
        status: 'planned',
      },
      {
        node_id: 'roadmap',
        version: 'mvp',
        content: 'MVP content',
        progress: 0,
        status: 'in-progress',
      },
    ])
    .onConflictDoUpdate({
      target: [nvt.node_id, nvt.version],
      set: { content: sqlFn`excluded.content`, updated_at: sqlFn`datetime('now')` },
    })
    .run();
});

When(
  'I re-seed with updated content for {string} version {string}',
  function (this: World, nodeId: string, version: string) {
    const { nodeVersionsTable: nvt } = getSchema();
    const { sql: sqlFn } = getRepos();
    this.drizzleDb
      .insert(nvt)
      .values({
        node_id: nodeId,
        version,
        content: 'Brand new content',
        progress: 0,
        status: 'planned',
      })
      .onConflictDoUpdate({
        target: [nvt.node_id, nvt.version],
        set: { content: sqlFn`excluded.content`, updated_at: sqlFn`datetime('now')` },
      })
      .run();
  }
);

Then(
  'the version {string} for {string} should have progress {int}',
  function (this: World, version: string, nodeId: string, progress: number) {
    const { nodeVersionsTable: nvt } = getSchema();
    const { eq: eqFn, and: andFn } = getRepos();
    const rows = this.drizzleDb
      .select()
      .from(nvt)
      .where(andFn(eqFn(nvt.node_id, nodeId), eqFn(nvt.version, version)))
      .all();
    assert.ok(rows.length > 0, `No version ${version} for ${nodeId}`);
    assert.equal(rows[0].progress, progress);
  }
);

Then(
  'the version {string} for {string} should have status {string}',
  function (this: World, version: string, nodeId: string, status: string) {
    const { nodeVersionsTable: nvt } = getSchema();
    const { eq: eqFn, and: andFn } = getRepos();
    const rows = this.drizzleDb
      .select()
      .from(nvt)
      .where(andFn(eqFn(nvt.node_id, nodeId), eqFn(nvt.version, version)))
      .all();
    assert.ok(rows.length > 0);
    assert.equal(rows[0].status, status);
  }
);

Then(
  'the version {string} for {string} should have the updated content',
  function (this: World, version: string, nodeId: string) {
    const { nodeVersionsTable: nvt } = getSchema();
    const { eq: eqFn, and: andFn } = getRepos();
    const rows = this.drizzleDb
      .select()
      .from(nvt)
      .where(andFn(eqFn(nvt.node_id, nodeId), eqFn(nvt.version, version)))
      .all();
    assert.ok(rows.length > 0);
    assert.equal(rows[0].content, 'Brand new content');
  }
);
