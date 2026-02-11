import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type { IEdgeRepository } from '../../src/domain/repositories/edge-repository.js';
import type { IFeatureRepository } from '../../src/domain/repositories/feature-repository.js';
import type { INodeRepository } from '../../src/domain/repositories/node-repository.js';
import type { IVersionRepository } from '../../src/domain/repositories/version-repository.js';
import { ExportArchitecture } from '../../src/use-cases/export-architecture.js';
import type { ArchitectureData } from '../../src/use-cases/get-architecture.js';

interface World {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  outputPath: string;
  writtenPath: string | null;
  writtenData: ArchitectureData | null;
  exportResult: { stats: ArchitectureData['stats'] };
}

function buildRepos(world: World) {
  const nodeRepo: INodeRepository = {
    findAll: async () => world.nodes,
    findById: async (id: string) => world.nodes.find(n => n.id === id) ?? null,
    findByType: async (type: string) => world.nodes.filter(n => n.type === type),
    findByLayer: async (layerId: string) => world.nodes.filter(n => n.layer === layerId),
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async () => {},
    delete: async () => {},
  };
  const edgeRepo: IEdgeRepository = {
    findAll: async () => world.edges,
    findBySource: async (sid: string) => world.edges.filter(e => e.source_id === sid),
    findByTarget: async (tid: string) => world.edges.filter(e => e.target_id === tid),
    findByType: async (type: string) => world.edges.filter(e => e.type === type),
    findRelationships: async () => world.edges.filter(e => !e.isContainment()),
    save: async () => {},
    delete: async () => {},
  };
  const versionRepo: IVersionRepository = {
    findAll: async () => world.versions,
    findByNode: async (nid: string) => world.versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async () => {},
    deleteByNode: async () => {},
  };
  const featureRepo: IFeatureRepository = {
    findAll: async () => world.features,
    findByNode: async (nid: string) => world.features.filter(f => f.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.features.filter(f => f.node_id === nid && f.version === ver),
    save: async () => {},
    deleteAll: async () => {},
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

// ─── Given ──────────────────────────────────────────────────────────

Given('an output path {string}', function (this: World, path: string) {
  this.outputPath = path;
  this.writtenPath = null;
  this.writtenData = null;
});

Given('the database contains nodes with versions and features', function (this: World) {
  this.nodes = [
    new Node({ id: 'layer-1', name: 'Layer 1', type: 'layer' }),
    new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' }),
  ];
  this.edges = [new Edge({ source_id: 'layer-1', target_id: 'comp-1', type: 'CONTAINS' })];
  this.versions = [
    new Version({
      node_id: 'comp-1',
      version: 'mvp',
      content: 'MVP spec',
      progress: 10,
      status: 'in-progress',
    }),
  ];
  this.features = [
    new Feature({ node_id: 'comp-1', version: 'mvp', filename: 'mvp-test.feature', title: 'Test' }),
  ];
});

// ─── When ───────────────────────────────────────────────────────────

When('I export the architecture', async function (this: World) {
  const repos = buildRepos(this);
  const writeJson = async (path: string, data: ArchitectureData) => {
    this.writtenPath = path;
    this.writtenData = data;
  };
  const useCase = new ExportArchitecture({ ...repos, writeJson });
  this.exportResult = await useCase.execute(this.outputPath || 'out.json');
});

// ─── Then ───────────────────────────────────────────────────────────

Then('the write function is called with path {string}', function (this: World, path: string) {
  assert.equal(this.writtenPath, path);
});

Then('the written data contains a {string} field', function (this: World, field: string) {
  assert.ok(this.writtenData, 'No data was written');
  assert.ok(field in this.writtenData, `Field ${field} missing from written data`);
});

Then('the export result includes stats with total counts', function (this: World) {
  assert.ok(this.exportResult.stats, 'Stats missing from export result');
  assert.ok('total_nodes' in this.exportResult.stats);
  assert.ok('total_edges' in this.exportResult.stats);
  assert.ok('total_versions' in this.exportResult.stats);
  assert.ok('total_features' in this.exportResult.stats);
});

Then('the written data includes layers with children', function (this: World) {
  assert.ok(this.writtenData, 'No data was written');
  assert.ok(Array.isArray(this.writtenData.layers), 'layers is not an array');
});

Then('the written data includes enriched nodes', function (this: World) {
  assert.ok(this.writtenData, 'No data was written');
  assert.ok(Array.isArray(this.writtenData.nodes), 'nodes is not an array');
  assert.ok(this.writtenData.nodes.length > 0, 'nodes array is empty');
});

Then('the written data includes relationship edges', function (this: World) {
  assert.ok(this.writtenData, 'No data was written');
  assert.ok(Array.isArray(this.writtenData.edges), 'edges is not an array');
});
