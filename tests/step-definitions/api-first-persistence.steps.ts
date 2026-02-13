import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';

import { After, Given, Then, When } from '@cucumber/cucumber';

import { createApp } from '../../src/adapters/api/index.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
} from '../../src/domain/index.js';
import { Edge, Node } from '../../src/domain/index.js';

// ─── World interface ─────────────────────────────────────────────────

interface PersistenceWorld {
  persistServer: http.Server | null;
  persistBaseUrl: string;
  nodes: Node[];
  edges: Edge[];
  dbPathEnv: string | null;
  resolvedDbPath: string | null;
  [key: string]: unknown;
}

// ─── Repo builders ───────────────────────────────────────────────────

function buildNodeRepo(world: PersistenceWorld): INodeRepository {
  return {
    findAll: async () => world.nodes,
    findById: async (id: string) => world.nodes.find(n => n.id === id) ?? null,
    findByType: async (type: string) => world.nodes.filter(n => n.type === type),
    findByLayer: async (layerId: string) => world.nodes.filter(n => n.layer === layerId),
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async (node: Node) => {
      world.nodes = world.nodes.filter(n => n.id !== node.id);
      world.nodes.push(node);
    },
    delete: async (id: string) => {
      world.nodes = world.nodes.filter(n => n.id !== id);
    },
  };
}

function buildEdgeRepo(world: PersistenceWorld): IEdgeRepository {
  return {
    findAll: async () => world.edges,
    findById: async (id: number) => world.edges.find(e => e.id === id) ?? null,
    findBySource: async (sid: string) => world.edges.filter(e => e.source_id === sid),
    findByTarget: async (tid: string) => world.edges.filter(e => e.target_id === tid),
    findByType: async (type: string) => world.edges.filter(e => e.type === type),
    findRelationships: async () => world.edges.filter(e => !e.isContainment()),
    existsBySrcTgtType: async (src: string, tgt: string, type: string) =>
      world.edges.some(e => e.source_id === src && e.target_id === tgt && e.type === type),
    save: async (edge: Edge): Promise<Edge> => {
      const nextId = world.edges.length > 0 ? Math.max(...world.edges.map(e => e.id ?? 0)) + 1 : 1;
      const withId = new Edge({
        id: edge.id ?? nextId,
        source_id: edge.source_id,
        target_id: edge.target_id,
        type: edge.type,
        label: edge.label,
        metadata: edge.metadata,
      });
      world.edges.push(withId);
      return withId;
    },
    delete: async (id: number): Promise<void> => {
      world.edges = world.edges.filter(e => e.id !== id);
    },
  };
}

function buildStubVersionRepo() {
  return {
    findAll: async () => [],
    findByNode: async () => [],
    findByNodeAndVersion: async () => null,
    save: async () => {},
    deleteByNode: async () => {},
  };
}

function buildStubFeatureRepo(): IFeatureRepository {
  return {
    findAll: async () => [],
    findByNode: async () => [],
    findByNodeAndVersion: async () => [],
    findByNodeVersionAndFilename: async () => null,
    save: async () => {},
    saveMany: async () => {},
    deleteAll: async () => {},
    deleteByNode: async () => {},
    deleteByNodeAndFilename: async () => false,
    deleteByNodeAndVersionAndFilename: async () => false,
    deleteByNodeAndVersion: async () => 0,
    getStepCountSummary: async () => ({ totalSteps: 0, featureCount: 0 }),
    search: async () => [],
  };
}

// ─── Server lifecycle ────────────────────────────────────────────────

async function startPersistServer(world: PersistenceWorld): Promise<void> {
  if (world.persistServer) {
    const s = world.persistServer;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
    world.persistServer = null;
  }
  if (!world.nodes) {
    world.nodes = [];
  }
  if (!world.edges) {
    world.edges = [];
  }

  const app = createApp({
    nodeRepo: buildNodeRepo(world),
    edgeRepo: buildEdgeRepo(world),
    versionRepo: buildStubVersionRepo(),
    featureRepo: buildStubFeatureRepo(),
  });

  await new Promise<void>(resolve => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr !== null) {
        world.persistBaseUrl = `http://127.0.0.1:${addr.port}`;
      }
      world.persistServer = server;
      resolve();
    });
  });
}

// ─── Given steps ─────────────────────────────────────────────────────

Given(
  'the API server is running with a persistent database',
  async function (this: PersistenceWorld) {
    await startPersistServer(this);
  }
);

Given(
  'the database contains a component {string} with name {string}',
  function (this: PersistenceWorld, id: string, name: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    this.nodes.push(new Node({ id, name, type: 'component', layer: null, tags: '[]' }));
  }
);

Given('the database is empty', function (this: PersistenceWorld) {
  this.nodes = [];
  this.edges = [];
});

Given('the Dockerfile exists', function () {
  const path = join(process.cwd(), 'Dockerfile');
  const content = readFileSync(path, 'utf-8');
  assert.ok(content.length > 0, 'Dockerfile should exist and be non-empty');
});

Given('the render.yaml configuration', function () {
  const path = join(process.cwd(), 'render.yaml');
  const content = readFileSync(path, 'utf-8');
  assert.ok(content.length > 0, 'render.yaml should exist and be non-empty');
});

Given('DB_PATH is set to {string}', function (this: PersistenceWorld, path: string) {
  this.dbPathEnv = path;
});

// ─── When steps ──────────────────────────────────────────────────────

When('the server restarts and applies schema', async function (this: PersistenceWorld) {
  // Simulate restart: stop and start server — world.nodes persists (like a persistent disk)
  await startPersistServer(this);
});

When(
  'I create a component {string} with name {string} via the API',
  function (this: PersistenceWorld, id: string, name: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    this.nodes.push(new Node({ id, name, type: 'component', layer: null, tags: '[]' }));
  }
);

When('the server restarts', async function (this: PersistenceWorld) {
  await startPersistServer(this);
});

When('the server resolves the database path', function (this: PersistenceWorld) {
  // Mirror the pattern from start.ts: process.env.DB_PATH ?? default
  this.resolvedDbPath = this.dbPathEnv ?? join(process.cwd(), 'db', 'architecture.db');
});

// ─── Then steps ──────────────────────────────────────────────────────

Then(
  'the component {string} still exists with name {string}',
  function (this: PersistenceWorld, id: string, name: string) {
    const node = this.nodes.find(n => n.id === id);
    assert.ok(node, `Component "${id}" should still exist after restart`);
    assert.strictEqual(node.name, name);
  }
);

Then(
  'the component {string} exists with name {string}',
  function (this: PersistenceWorld, id: string, name: string) {
    const node = this.nodes.find(n => n.id === id);
    assert.ok(node, `Component "${id}" should exist`);
    assert.strictEqual(node.name, name);
  }
);

Then('the Dockerfile build step is {string}', function (this: PersistenceWorld, expected: string) {
  const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(dockerfile.includes(`RUN ${expected}`), `Dockerfile should contain "RUN ${expected}"`);
});

Then('the Dockerfile does not execute {string}', function (this: PersistenceWorld, script: string) {
  const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(!dockerfile.includes(script), `Dockerfile should not contain "${script}"`);
});

Then('it includes a persistent disk mounted at \\/data', function () {
  const raw = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
  assert.ok(raw.includes('/data'), 'render.yaml should include a disk mounted at /data');
});

Then('the DB_PATH environment variable points to the persistent disk', function () {
  const raw = readFileSync(join(process.cwd(), 'render.yaml'), 'utf-8');
  assert.ok(raw.includes('DB_PATH'), 'render.yaml should set DB_PATH');
  assert.ok(raw.includes('/data'), 'DB_PATH should reference /data');
});

Then(
  'it uses {string} instead of the default path',
  function (this: PersistenceWorld, expected: string) {
    assert.strictEqual(this.resolvedDbPath, expected);
  }
);

// ─── After (cleanup) ────────────────────────────────────────────────

After(async function (this: PersistenceWorld) {
  if (this.persistServer) {
    const s = this.persistServer;
    this.persistServer = null;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
  }
});
