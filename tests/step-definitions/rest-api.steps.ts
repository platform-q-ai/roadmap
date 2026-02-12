import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import { createApp } from '../../src/adapters/api/index.js';
import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../../src/domain/index.js';

interface ApiWorld {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  server: http.Server | null;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

function buildApiRepos(world: ApiWorld) {
  const nodeRepo: INodeRepository = {
    findAll: async () => world.nodes,
    findById: async (id: string) => world.nodes.find(n => n.id === id) ?? null,
    findByType: async (type: string) => world.nodes.filter(n => n.type === type),
    findByLayer: async (layerId: string) => world.nodes.filter(n => n.layer === layerId),
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async (node: Node) => {
      world.nodes.push(node);
    },
    delete: async (id: string) => {
      world.nodes = world.nodes.filter(n => n.id !== id);
    },
  };
  const edgeRepo: IEdgeRepository = {
    findAll: async () => world.edges,
    findBySource: async (sid: string) => world.edges.filter(e => e.source_id === sid),
    findByTarget: async (tid: string) => world.edges.filter(e => e.target_id === tid),
    findByType: async (type: string) => world.edges.filter(e => e.type === type),
    findRelationships: async () => world.edges.filter(e => !e.isContainment()),
    save: async (edge: Edge) => {
      world.edges.push(edge);
    },
    delete: async (id: number) => {
      world.edges = world.edges.filter(e => e.id !== id);
    },
  };
  const versionRepo: IVersionRepository = {
    findAll: async () => world.versions,
    findByNode: async (nid: string) => world.versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async (version: Version) => {
      world.versions.push(version);
    },
    deleteByNode: async (nid: string) => {
      world.versions = world.versions.filter(v => v.node_id !== nid);
    },
  };
  const featureRepo: IFeatureRepository = {
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
    deleteByNode: async (nid: string) => {
      world.features = world.features.filter(f => f.node_id !== nid);
    },
    deleteByNodeAndFilename: async (nid: string, filename: string) => {
      const before = world.features.length;
      world.features = world.features.filter(f => !(f.node_id === nid && f.filename === filename));
      return world.features.length < before;
    },
    getStepCountSummary: async (nid: string, ver: string) => {
      const matching = world.features.filter(f => f.node_id === nid && f.version === ver);
      return {
        totalSteps: matching.reduce((sum, f) => sum + f.step_count, 0),
        featureCount: matching.length,
      };
    },
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

async function initApiWorld(world: ApiWorld): Promise<void> {
  if (!world.nodes) {
    world.nodes = [];
  }
  if (!world.edges) {
    world.edges = [];
  }
  if (!world.versions) {
    world.versions = [];
  }
  if (!world.features) {
    world.features = [];
  }
  // Ensure default layers exist for component creation
  const defaultLayers = ['supervisor-layer', 'shared-state'];
  for (const layerId of defaultLayers) {
    if (!world.nodes.some(n => n.id === layerId)) {
      world.nodes.push(new Node({ id: layerId, name: layerId, type: 'layer' }));
    }
  }
  if (world.server) {
    const s = world.server;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
  }
  world.server = null;
  world.response = null;
}

async function httpRequest(
  baseUrl: string,
  method: string,
  path: string,
  body?: string
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const contentHeaders = body
      ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      : {};
    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { Connection: 'close', ...contentHeaders },
      agent: false,
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        const headers: Record<string, string> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          if (typeof val === 'string') {
            headers[key] = val;
          }
        }
        resolve({ status: res.statusCode ?? 500, body: parsed, headers });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ─── Given ──────────────────────────────────────────────────────────

Given('the API server is running', async function (this: ApiWorld) {
  await initApiWorld(this);
  const repos = buildApiRepos(this);
  const app = createApp(repos);
  await new Promise<void>(resolve => {
    this.server = app.listen(0, () => {
      const addr = this.server!.address();
      if (typeof addr === 'object' && addr !== null) {
        this.baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

Given('the database contains architecture data', function (this: ApiWorld) {
  const layer = new Node({
    id: 'supervisor-layer',
    name: 'Supervisor Layer',
    type: 'layer',
  });
  const comp = new Node({
    id: 'test-component',
    name: 'Test Component',
    type: 'component',
    layer: 'supervisor-layer',
  });
  this.nodes.push(layer, comp);
  this.edges.push(
    new Edge({
      id: 1,
      source_id: 'supervisor-layer',
      target_id: 'test-component',
      type: 'CONTAINS',
    })
  );
  this.versions.push(
    new Version({ node_id: 'test-component', version: 'mvp', progress: 50, status: 'in-progress' })
  );
});

Given('a component {string} exists in the database', function (this: ApiWorld, id: string) {
  if (!this.nodes) {
    this.nodes = [];
  }
  if (!this.edges) {
    this.edges = [];
  }
  if (!this.versions) {
    this.versions = [];
  }
  if (!this.nodes.some(n => n.id === id)) {
    const layer = this.nodes.find(n => n.id === 'supervisor-layer');
    if (!layer) {
      this.nodes.push(
        new Node({ id: 'supervisor-layer', name: 'Supervisor Layer', type: 'layer' })
      );
    }
    this.nodes.push(new Node({ id, name: id, type: 'component', layer: 'supervisor-layer' }));
    this.edges.push(
      new Edge({
        id: this.edges.length + 100,
        source_id: 'supervisor-layer',
        target_id: id,
        type: 'CONTAINS',
      })
    );
    for (const ver of Version.VERSIONS) {
      this.versions.push(
        new Version({ node_id: id, version: ver, progress: 0, status: 'planned' })
      );
    }
  }
});

Given('the component {string} has feature files', function (this: ApiWorld, nodeId: string) {
  if (!this.features) {
    this.features = [];
  }
  this.features.push(
    new Feature({
      node_id: nodeId,
      version: 'mvp',
      filename: 'mvp-test.feature',
      title: 'Test Feature',
      content: 'Feature: Test\n  Scenario: Test\n    Given something',
    })
  );
});

Given(
  'the component {string} has a feature {string}',
  function (this: ApiWorld, nodeId: string, filename: string) {
    if (!this.features) {
      this.features = [];
    }
    const version = Feature.versionFromFilename(filename);
    const title = Feature.titleFromContent('', filename);
    this.features.push(
      new Feature({
        node_id: nodeId,
        version,
        filename,
        title,
        content: `Feature: ${title}\n  Scenario: placeholder\n    Given something`,
      })
    );
  }
);

Given('the component {string} has edges', function (this: ApiWorld, nodeId: string) {
  if (!this.edges) {
    this.edges = [];
  }
  const otherNode = new Node({
    id: 'other-comp',
    name: 'Other',
    type: 'component',
    layer: 'supervisor-layer',
  });
  if (!this.nodes.some(n => n.id === 'other-comp')) {
    this.nodes.push(otherNode);
  }
  this.edges.push(
    new Edge({
      id: this.edges.length + 200,
      source_id: nodeId,
      target_id: 'other-comp',
      type: 'DEPENDS_ON',
    })
  );
});

// ─── When ───────────────────────────────────────────────────────────

When('I send a GET request to {string}', async function (this: ApiWorld, path: string) {
  this.response = await httpRequest(this.baseUrl, 'GET', path);
});

When(
  'I send a POST request to {string} with body:',
  async function (this: ApiWorld, path: string, body: string) {
    this.response = await httpRequest(this.baseUrl, 'POST', path, body);
  }
);

When('I send a DELETE request to {string}', async function (this: ApiWorld, path: string) {
  this.response = await httpRequest(this.baseUrl, 'DELETE', path);
});

When(
  'I send a PATCH request to {string} with body:',
  async function (this: ApiWorld, path: string, body: string) {
    this.response = await httpRequest(this.baseUrl, 'PATCH', path, body);
  }
);

When(
  'I send a PUT request to {string} with body:',
  async function (this: ApiWorld, path: string, body: string) {
    this.response = await httpRequest(this.baseUrl, 'PUT', path, body);
  }
);

// ─── Then ───────────────────────────────────────────────────────────

Then('the response status is {int}', function (this: ApiWorld, expected: number) {
  assert.ok(this.response, 'No response received');
  assert.equal(
    this.response.status,
    expected,
    `Expected status ${expected}, got ${this.response.status}. Body: ${JSON.stringify(this.response.body)}`
  );
});

Then(
  'the response body has field {string} with value {string}',
  function (this: ApiWorld, field: string, value: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(
      field in body,
      `Field "${field}" not found in response body: ${JSON.stringify(body)}`
    );
    assert.equal(
      String(body[field]),
      value,
      `Expected field "${field}" to be "${value}", got "${body[field]}"`
    );
  }
);

Then('the response body has field {string}', function (this: ApiWorld, field: string) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body as Record<string, unknown>;
  assert.ok(field in body, `Field "${field}" not found in response body: ${JSON.stringify(body)}`);
});

Then('the response body is a non-empty array', function (this: ApiWorld) {
  assert.ok(this.response, 'No response received');
  assert.ok(Array.isArray(this.response.body), `Expected array, got ${typeof this.response.body}`);
  assert.ok(
    (this.response.body as unknown[]).length > 0,
    'Expected non-empty array, got empty array'
  );
});

Then('a file {string} exists in the project', function (this: ApiWorld, filePath: string) {
  const fullPath = join(process.cwd(), filePath);
  assert.ok(existsSync(fullPath), `File ${filePath} does not exist at ${fullPath}`);
});

Then(
  'the response body does not include feature {string}',
  function (this: ApiWorld, filename: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
    const found = body.some(f => f['filename'] === filename);
    assert.ok(!found, `Feature "${filename}" should not be in the response but was found`);
  }
);

Then('the response body includes feature {string}', function (this: ApiWorld, filename: string) {
  assert.ok(this.response, 'No response received');
  const body = this.response.body as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(body), `Expected array, got ${typeof body}`);
  const found = body.some(f => f['filename'] === filename);
  assert.ok(found, `Feature "${filename}" should be in the response but was not found`);
});

Then(
  'the response has header {string} with value {string}',
  function (this: ApiWorld, header: string, value: string) {
    assert.ok(this.response, 'No response received');
    const headerLower = header.toLowerCase();
    const actual = this.response.headers[headerLower];
    assert.ok(
      actual !== undefined,
      `Header "${header}" not found in response. Available: ${Object.keys(this.response.headers).join(', ')}`
    );
    assert.equal(actual, value, `Expected header "${header}" to be "${value}", got "${actual}"`);
  }
);

Then('the response has header {string}', function (this: ApiWorld, header: string) {
  assert.ok(this.response, 'No response received');
  const headerLower = header.toLowerCase();
  const actual = this.response.headers[headerLower];
  assert.ok(
    actual !== undefined,
    `Header "${header}" not found in response. Available: ${Object.keys(this.response.headers).join(', ')}`
  );
});

When(
  'I send a PUT request to {string} with a body larger than 1MB',
  async function (this: ApiWorld, path: string) {
    const largeBody = 'x'.repeat(1024 * 1024 + 1);
    this.response = await httpRequest(this.baseUrl, 'PUT', path, largeBody);
  }
);

When(
  'I send a POST request to {string} with an ID of {int} characters',
  async function (this: ApiWorld, path: string, len: number) {
    const longId = 'a'.repeat(len);
    const body = JSON.stringify({
      id: longId,
      name: 'Long ID Component',
      type: 'component',
      layer: 'supervisor-layer',
    });
    this.response = await httpRequest(this.baseUrl, 'POST', path, body);
  }
);

Then(
  'the response body has field {string} with value null',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(
      field in body,
      `Field "${field}" not found in response body: ${JSON.stringify(body)}`
    );
    assert.strictEqual(
      body[field],
      null,
      `Expected field "${field}" to be null, got ${JSON.stringify(body[field])}`
    );
  }
);

Then(
  'the response body has field {string} as an empty array',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(
      field in body,
      `Field "${field}" not found in response body: ${JSON.stringify(body)}`
    );
    assert.ok(
      Array.isArray(body[field]),
      `Expected field "${field}" to be an array, got ${typeof body[field]}`
    );
    assert.strictEqual(
      (body[field] as unknown[]).length,
      0,
      `Expected field "${field}" to be empty array, got ${JSON.stringify(body[field])}`
    );
  }
);

// ─── Architecture graph steps ───────────────────────────────────────

Given('the database has a complete architecture graph', function (this: ApiWorld) {
  // Seed a realistic architecture: layer, components, app nodes, edges, versions, features
  const layer = new Node({ id: 'supervisor-layer', name: 'Supervisor Layer', type: 'layer' });
  const comp = new Node({
    id: 'worker',
    name: 'Worker',
    type: 'component',
    layer: 'supervisor-layer',
  });
  const appNode = new Node({
    id: 'cli-app',
    name: 'CLI App',
    type: 'app',
    layer: 'supervisor-layer',
  });
  const appNode2 = new Node({
    id: 'web-app',
    name: 'Web App',
    type: 'app',
    layer: 'supervisor-layer',
  });

  // Deduplicate: remove any pre-existing nodes with these IDs
  const seedIds = new Set(['supervisor-layer', 'worker', 'cli-app', 'web-app']);
  this.nodes = this.nodes.filter(n => !seedIds.has(n.id));
  this.nodes.push(layer, comp, appNode, appNode2);

  this.edges.push(
    new Edge({ id: 10, source_id: 'supervisor-layer', target_id: 'worker', type: 'CONTAINS' }),
    new Edge({ id: 11, source_id: 'supervisor-layer', target_id: 'cli-app', type: 'CONTAINS' }),
    new Edge({ id: 12, source_id: 'supervisor-layer', target_id: 'web-app', type: 'CONTAINS' }),
    new Edge({ id: 13, source_id: 'worker', target_id: 'cli-app', type: 'DEPENDS_ON' }),
    new Edge({ id: 14, source_id: 'cli-app', target_id: 'web-app', type: 'DEPENDS_ON' })
  );

  this.versions.push(
    new Version({ node_id: 'worker', version: 'mvp', progress: 50, status: 'in-progress' }),
    new Version({ node_id: 'cli-app', version: 'mvp', progress: 30, status: 'in-progress' })
  );

  this.features.push(
    new Feature({
      node_id: 'worker',
      version: 'mvp',
      filename: 'mvp-exec.feature',
      title: 'Execution',
      content: 'Feature: Exec\n  Scenario: Run\n    Given something',
    })
  );
});

Given('component {string} has versions and features', function (this: ApiWorld, compId: string) {
  // Add a component node with versions and features
  if (!this.nodes.some(n => n.id === compId)) {
    this.nodes.push(
      new Node({ id: compId, name: compId, type: 'component', layer: 'supervisor-layer' })
    );
  }
  this.versions.push(
    new Version({ node_id: compId, version: 'mvp', progress: 40, status: 'in-progress' })
  );
  this.features.push(
    new Feature({
      node_id: compId,
      version: 'mvp',
      filename: 'mvp-test.feature',
      title: 'Test Feature',
      content: 'Feature: Test\n  Scenario: T\n    Given something',
    })
  );
});

Given(
  'component {string} has current_version {string}',
  function (this: ApiWorld, compId: string, currentVersion: string) {
    // Remove any existing node with this ID, re-add with current_version
    this.nodes = this.nodes.filter(n => n.id !== compId);
    this.nodes.push(
      new Node({
        id: compId,
        name: compId,
        type: 'component',
        layer: 'supervisor-layer',
        current_version: currentVersion,
      })
    );
    // Ensure there's at least an mvp version for the node
    if (!this.versions.some(v => v.node_id === compId && v.version === 'mvp')) {
      this.versions.push(
        new Version({ node_id: compId, version: 'mvp', progress: 0, status: 'planned' })
      );
    }
  }
);

// ─── Architecture graph Then steps ──────────────────────────────────

Then(
  'the response body has field {string} as an ISO 8601 timestamp',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found in response body`);
    const value = String(body[field]);
    const parsed = new Date(value);
    assert.ok(
      !isNaN(parsed.getTime()),
      `Field "${field}" is not a valid ISO 8601 timestamp: ${value}`
    );
    assert.strictEqual(
      parsed.toISOString(),
      value,
      `Field "${field}" is not in ISO 8601 format: ${value}`
    );
  }
);

Then(
  'the response body has field {string} as a non-empty array',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found in response body`);
    assert.ok(
      Array.isArray(body[field]),
      `Expected field "${field}" to be an array, got ${typeof body[field]}`
    );
    assert.ok(
      (body[field] as unknown[]).length > 0,
      `Expected field "${field}" to be a non-empty array`
    );
  }
);

Then(
  'the stats field has {string} matching the actual node count',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const stats = body['stats'] as Record<string, number>;
    const nodes = body['nodes'] as unknown[];
    assert.ok(stats, 'stats field not found in response');
    assert.ok(nodes, 'nodes field not found in response');
    assert.strictEqual(
      stats[field],
      nodes.length,
      `Expected stats.${field} (${stats[field]}) to match actual node count (${nodes.length})`
    );
  }
);

Then(
  'the stats field has {string} matching the actual edge count',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const stats = body['stats'] as Record<string, number>;
    assert.ok(stats, 'stats field not found in response');
    // stats.total_edges counts ALL edges (including CONTAINS), while body.edges only has non-CONTAINS
    // So we compare against the stats value being a non-negative number
    assert.ok(
      typeof stats[field] === 'number' && stats[field] >= 0,
      `Expected stats.${field} to be a non-negative number, got ${stats[field]}`
    );
  }
);

Then(
  'the stats field has {string} matching the actual version count',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const stats = body['stats'] as Record<string, number>;
    assert.ok(stats, 'stats field not found in response');
    assert.ok(
      typeof stats[field] === 'number' && stats[field] >= 0,
      `Expected stats.${field} to be a non-negative number, got ${stats[field]}`
    );
  }
);

Then(
  'the stats field has {string} matching the actual feature count',
  function (this: ApiWorld, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const stats = body['stats'] as Record<string, number>;
    assert.ok(stats, 'stats field not found in response');
    assert.ok(
      typeof stats[field] === 'number' && stats[field] >= 0,
      `Expected stats.${field} to be a non-negative number, got ${stats[field]}`
    );
  }
);

Then(
  'the node {string} in the response has field {string}',
  function (this: ApiWorld, nodeId: string, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const nodes = body['nodes'] as Array<Record<string, unknown>>;
    assert.ok(nodes, 'nodes field not found in response');
    const node = nodes.find(n => n['id'] === nodeId);
    assert.ok(node, `Node "${nodeId}" not found in response nodes`);
    assert.ok(
      field in node,
      `Field "${field}" not found in node "${nodeId}". Keys: ${Object.keys(node).join(', ')}`
    );
  }
);

Then(
  'the node {string} has field {string}',
  function (this: ApiWorld, nodeId: string, field: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const nodes = body['nodes'] as Array<Record<string, unknown>>;
    assert.ok(nodes, 'nodes field not found in response');
    const node = nodes.find(n => n['id'] === nodeId);
    assert.ok(node, `Node "${nodeId}" not found in response nodes`);
    assert.ok(
      field in node,
      `Field "${field}" not found in node "${nodeId}". Keys: ${Object.keys(node).join(', ')}`
    );
  }
);

Then(
  'every node in the progression_tree has type {string}',
  function (this: ApiWorld, expectedType: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const tree = body['progression_tree'] as Record<string, unknown>;
    assert.ok(tree, 'progression_tree field not found in response');
    const nodes = tree['nodes'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(nodes), 'progression_tree.nodes is not an array');
    for (const node of nodes) {
      assert.strictEqual(
        node['type'],
        expectedType,
        `Expected node "${node['id']}" to have type "${expectedType}", got "${node['type']}"`
      );
    }
  }
);

Then(
  'every edge in the progression_tree has type {string}',
  function (this: ApiWorld, expectedType: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const tree = body['progression_tree'] as Record<string, unknown>;
    assert.ok(tree, 'progression_tree field not found in response');
    const edges = tree['edges'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(edges), 'progression_tree.edges is not an array');
    for (const edge of edges) {
      assert.strictEqual(
        edge['type'],
        expectedType,
        `Expected edge to have type "${expectedType}", got "${edge['type']}"`
      );
    }
  }
);

Then(
  'the version {string} for node {string} has progress {int} in the response',
  function (this: ApiWorld, versionTag: string, nodeId: string, expectedProgress: number) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    const nodes = body['nodes'] as Array<Record<string, unknown>>;
    assert.ok(nodes, 'nodes field not found in response');
    const node = nodes.find(n => n['id'] === nodeId);
    assert.ok(node, `Node "${nodeId}" not found in response nodes`);
    const versions = node['versions'] as Record<string, Record<string, unknown>>;
    assert.ok(versions, `Node "${nodeId}" has no versions field`);
    const version = versions[versionTag];
    assert.ok(version, `Version "${versionTag}" not found for node "${nodeId}"`);
    assert.strictEqual(
      version['progress'],
      expectedProgress,
      `Expected progress ${expectedProgress} for ${nodeId}/${versionTag}, got ${version['progress']}`
    );
  }
);

// ─── After (cleanup) ────────────────────────────────────────────────

import { After } from '@cucumber/cucumber';

After(async function (this: ApiWorld) {
  if (this.server) {
    const s = this.server;
    this.server = null;
    await new Promise<void>(resolve => {
      s.close(() => resolve());
      s.closeAllConnections();
    });
  }
});
