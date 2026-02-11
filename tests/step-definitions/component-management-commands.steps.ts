import { strict as assert } from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
  NodeType,
  VersionTag,
} from '../../src/domain/index.js';
import { Edge, Feature, Node, Version } from '../../src/domain/index.js';
import type { ArchitectureData } from '../../src/use-cases/index.js';
import { CreateComponent, DeleteComponent, ExportArchitecture } from '../../src/use-cases/index.js';

const COMPONENT_COMMANDS = [
  'component-create.md',
  'component-delete.md',
  'component-update.md',
  'component-publish.md',
];

interface World {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  error: Error | null;
  savedNodes: Node[];
  savedEdges: Edge[];
  savedVersions: Version[];
  deletedNodeIds: string[];
  deletedVersionNodeIds: string[];
  deletedFeatureNodeIds: string[];
  deletedEdgeIds: number[];
  writtenData: ArchitectureData | null;
  [key: string]: unknown;
}

function initWorld(world: World) {
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
  if (!world.savedNodes) {
    world.savedNodes = [];
  }
  if (!world.savedEdges) {
    world.savedEdges = [];
  }
  if (!world.savedVersions) {
    world.savedVersions = [];
  }
  if (!world.deletedNodeIds) {
    world.deletedNodeIds = [];
  }
  if (!world.deletedVersionNodeIds) {
    world.deletedVersionNodeIds = [];
  }
  if (!world.deletedFeatureNodeIds) {
    world.deletedFeatureNodeIds = [];
  }
  if (!world.deletedEdgeIds) {
    world.deletedEdgeIds = [];
  }
  world.error = null;
}

function buildTrackingRepos(world: World) {
  const nodeRepo: INodeRepository = {
    findAll: async () => world.nodes,
    findById: async (id: string) => world.nodes.find(n => n.id === id) ?? null,
    findByType: async (type: string) => world.nodes.filter(n => n.type === type),
    findByLayer: async (layerId: string) => world.nodes.filter(n => n.layer === layerId),
    exists: async (id: string) => world.nodes.some(n => n.id === id),
    save: async (node: Node) => {
      world.savedNodes.push(node);
    },
    delete: async (id: string) => {
      world.deletedNodeIds.push(id);
    },
  };
  const edgeRepo: IEdgeRepository = {
    findAll: async () => world.edges,
    findBySource: async (sid: string) => world.edges.filter(e => e.source_id === sid),
    findByTarget: async (tid: string) => world.edges.filter(e => e.target_id === tid),
    findByType: async (type: string) => world.edges.filter(e => e.type === type),
    findRelationships: async () => world.edges.filter(e => !e.isContainment()),
    save: async (edge: Edge) => {
      world.savedEdges.push(edge);
    },
    delete: async (id: number) => {
      world.deletedEdgeIds.push(id);
    },
  };
  const versionRepo: IVersionRepository = {
    findAll: async () => world.versions,
    findByNode: async (nid: string) => world.versions.filter(v => v.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.versions.find(v => v.node_id === nid && v.version === ver) ?? null,
    save: async (version: Version) => {
      world.savedVersions.push(version);
    },

    deleteByNode: async (nid: string) => {
      world.deletedVersionNodeIds.push(nid);
    },
  };
  const featureRepo: IFeatureRepository = {
    findAll: async () => world.features,
    findByNode: async (nid: string) => world.features.filter(f => f.node_id === nid),
    findByNodeAndVersion: async (nid: string, ver: string) =>
      world.features.filter(f => f.node_id === nid && f.version === ver),
    save: async () => {},
    deleteAll: async () => {},
    deleteByNode: async (nid: string) => {
      world.deletedFeatureNodeIds.push(nid);
    },
  };
  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

// ─── Given (CreateComponent / DeleteComponent) ──────────────────────

Given(
  'a version {string} for component {string} with progress {int}',
  function (this: World, version: string, nodeId: string, progress: number) {
    if (!this.versions) {
      this.versions = [];
    }
    this.versions.push(
      new Version({
        node_id: nodeId,
        version: version as VersionTag,
        progress,
        status: 'planned',
      })
    );
  }
);

Given('a feature for component {string}', function (this: World, nodeId: string) {
  if (!this.features) {
    this.features = [];
  }
  this.features.push(
    new Feature({
      node_id: nodeId,
      version: 'mvp',
      filename: 'mvp-test.feature',
      title: 'Test Feature',
    })
  );
});

// ─── When (CreateComponent) ─────────────────────────────────────────

When(
  'I create a component with id {string} name {string} type {string} and layer {string}',
  async function (this: World, id: string, name: string, type: string, layer: string) {
    initWorld(this);
    const repos = buildTrackingRepos(this);
    const useCase = new CreateComponent({
      nodeRepo: repos.nodeRepo,
      edgeRepo: repos.edgeRepo,
      versionRepo: repos.versionRepo,
    });
    try {
      await useCase.execute({ id, name, type: type as NodeType, layer });
    } catch (err) {
      this.error = err as Error;
    }
  }
);

When(
  'I create a component with id {string} name {string} type {string} layer {string} description {string} and tags {string}',
  async function (
    this: World,
    id: string,
    name: string,
    type: string,
    layer: string,
    description: string,
    tags: string
  ) {
    initWorld(this);
    const repos = buildTrackingRepos(this);
    const useCase = new CreateComponent({
      nodeRepo: repos.nodeRepo,
      edgeRepo: repos.edgeRepo,
      versionRepo: repos.versionRepo,
    });
    try {
      await useCase.execute({
        id,
        name,
        type: type as NodeType,
        layer,
        description,
        tags: tags.split(','),
      });
    } catch (err) {
      this.error = err as Error;
    }
  }
);

// ─── When (DeleteComponent) ─────────────────────────────────────────

When('I delete the component {string}', async function (this: World, id: string) {
  initWorld(this);
  const repos = buildTrackingRepos(this);
  const useCase = new DeleteComponent({
    nodeRepo: repos.nodeRepo,
    edgeRepo: repos.edgeRepo,
    versionRepo: repos.versionRepo,
    featureRepo: repos.featureRepo,
  });
  try {
    await useCase.execute(id);
  } catch (err) {
    this.error = err as Error;
  }
});

// ─── When (Publish) ─────────────────────────────────────────────────

When('I run the publish workflow', async function (this: World) {
  initWorld(this);
  const repos = buildTrackingRepos(this);
  const writeJson = async (_path: string, data: ArchitectureData) => {
    this.writtenData = data;
  };
  const useCase = new ExportArchitecture({ ...repos, writeJson });
  await useCase.execute('web/data.json');
});

// ─── Then (CreateComponent) ─────────────────────────────────────────

Then(
  'the node {string} is saved with name {string} and type {string}',
  function (this: World, id: string, name: string, type: string) {
    assert.equal(this.error, null, `Unexpected error: ${this.error?.message}`);
    const saved = this.savedNodes.find(n => n.id === id);
    assert.ok(saved, `Node ${id} was not saved`);
    assert.equal(saved.name, name);
    assert.equal(saved.type, type);
  }
);

Then(
  'a CONTAINS edge from {string} to {string} is created',
  function (this: World, source: string, target: string) {
    const edge = this.savedEdges.find(
      e => e.source_id === source && e.target_id === target && e.type === 'CONTAINS'
    );
    assert.ok(edge, `No CONTAINS edge from ${source} to ${target} was saved`);
  }
);

Then(
  'the node {string} is saved with description {string}',
  function (this: World, id: string, description: string) {
    assert.equal(this.error, null, `Unexpected error: ${this.error?.message}`);
    const saved = this.savedNodes.find(n => n.id === id);
    assert.ok(saved, `Node ${id} was not saved`);
    assert.equal(saved.description, description);
  }
);

Then(
  'the node {string} has tags {string} and {string}',
  function (this: World, id: string, tag1: string, tag2: string) {
    const saved = this.savedNodes.find(n => n.id === id);
    assert.ok(saved, `Node ${id} was not saved`);
    assert.ok(saved.tags.includes(tag1), `Tag ${tag1} missing`);
    assert.ok(saved.tags.includes(tag2), `Tag ${tag2} missing`);
  }
);

Then(
  'versions {string}, {string}, {string}, {string} are created for node {string}',
  function (this: World, v1: string, v2: string, v3: string, v4: string, nodeId: string) {
    const nodeVersions = this.savedVersions.filter(v => v.node_id === nodeId);
    for (const ver of [v1, v2, v3, v4]) {
      assert.ok(
        nodeVersions.some(v => v.version === ver),
        `Version ${ver} not created for ${nodeId}`
      );
    }
  }
);

Then(
  'all versions have progress {int} and status {string}',
  function (this: World, progress: number, status: string) {
    for (const v of this.savedVersions) {
      assert.equal(v.progress, progress, `Version ${v.version} has progress ${v.progress}`);
      assert.equal(v.status, status, `Version ${v.version} has status ${v.status}`);
    }
  }
);

Then(
  'the create operation fails with error {string}',
  function (this: World, expectedFragment: string) {
    assert.ok(this.error, 'Expected an error but none was thrown');
    assert.ok(
      this.error.message.includes(expectedFragment),
      `Expected error containing "${expectedFragment}", got: "${this.error.message}"`
    );
  }
);

// ─── Then (DeleteComponent) ─────────────────────────────────────────

Then('the node {string} is removed', function (this: World, id: string) {
  assert.equal(this.error, null, `Unexpected error: ${this.error?.message}`);
  assert.ok(this.deletedNodeIds.includes(id), `Node ${id} was not deleted`);
});

Then('all versions for {string} are removed', function (this: World, nodeId: string) {
  assert.ok(this.deletedVersionNodeIds.includes(nodeId), `Versions for ${nodeId} were not deleted`);
});

Then('all features for {string} are removed', function (this: World, nodeId: string) {
  assert.ok(this.deletedFeatureNodeIds.includes(nodeId), `Features for ${nodeId} were not deleted`);
});

Then('all edges referencing {string} are removed', function (this: World, nodeId: string) {
  assert.ok(this.deletedEdgeIds.length > 0, `No edges were deleted for ${nodeId}`);
});

Then(
  'the delete operation fails with error {string}',
  function (this: World, expectedFragment: string) {
    assert.ok(this.error, 'Expected an error but none was thrown');
    assert.ok(
      this.error.message.includes(expectedFragment),
      `Expected error containing "${expectedFragment}", got: "${this.error.message}"`
    );
  }
);

// ─── Then (Publish) ─────────────────────────────────────────────────

Then('the export produces a JSON file', function (this: World) {
  assert.ok(this.writtenData, 'No data was written by the publish workflow');
});

Then('the exported data contains the latest node data', function (this: World) {
  assert.ok(this.writtenData, 'No data was written');
  assert.ok(Array.isArray(this.writtenData.nodes), 'Exported data has no nodes array');
  assert.ok('generated_at' in this.writtenData, 'No generated_at timestamp');
});

// ─── Then (OpenCode command files) ──────────────────────────────────

Given('the project has an .opencode\\/commands directory', function (this: World) {
  const dir = join(process.cwd(), '.opencode', 'commands');
  assert.ok(existsSync(dir), `.opencode/commands directory does not exist at ${dir}`);
});

Then('a command file {string} exists', function (this: World, filename: string) {
  const filePath = join(process.cwd(), '.opencode', 'commands', filename);
  assert.ok(existsSync(filePath), `Command file ${filename} does not exist at ${filePath}`);
});

Then(
  'each component command file has a {string} in frontmatter',
  function (this: World, field: string) {
    for (const cmd of COMPONENT_COMMANDS) {
      const filePath = join(process.cwd(), '.opencode', 'commands', cmd);
      const content = readFileSync(filePath, 'utf-8');
      assert.ok(
        content.includes(`${field}:`),
        `Command ${cmd} is missing "${field}" in frontmatter`
      );
    }
  }
);

Then(
  'each component command file references {string} for parameters',
  function (this: World, placeholder: string) {
    const cmdsWithArgs = COMPONENT_COMMANDS.filter(c => c !== 'component-publish.md');
    for (const cmd of cmdsWithArgs) {
      const filePath = join(process.cwd(), '.opencode', 'commands', cmd);
      const content = readFileSync(filePath, 'utf-8');
      assert.ok(
        content.includes(placeholder),
        `Command ${cmd} does not reference "${placeholder}"`
      );
    }
  }
);

// ─── Then (Command files must not use raw sqlite3) ──────────────────

Then(
  'no command file contains a raw {string} CLI invocation',
  function (this: World, forbidden: string) {
    const commandsDir = join(process.cwd(), '.opencode', 'commands');
    const files = readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(join(commandsDir, file), 'utf-8');
      if (content.includes(forbidden)) {
        violations.push(file);
      }
    }
    assert.equal(
      violations.length,
      0,
      `Command files contain raw "${forbidden}" references: ${violations.join(', ')}. ` +
        'Commands should use CLI adapters, not direct database access.'
    );
  }
);

// ─── Then (Commands use API routes) ──────────────────────────────────

const API_BASE_URL_PATTERN = 'https://roadmap-5vvp.onrender.com';

Then(
  'the command file {string} references API route {string} {string}',
  function (this: World, filename: string, method: string, path: string) {
    const filePath = join(process.cwd(), '.opencode', 'commands', filename);
    const content = readFileSync(filePath, 'utf-8');
    assert.ok(
      content.includes(method),
      `Command ${filename} does not reference HTTP method "${method}"`
    );
    assert.ok(content.includes(path), `Command ${filename} does not reference API path "${path}"`);
  }
);

Then(
  'the command file {string} does not reference {string}',
  function (this: World, filename: string, forbidden: string) {
    const filePath = join(process.cwd(), '.opencode', 'commands', filename);
    const content = readFileSync(filePath, 'utf-8');
    assert.ok(
      !content.includes(forbidden),
      `Command ${filename} still references "${forbidden}" — should use API routes instead`
    );
  }
);

Then(
  'the command file {string} references the API base URL',
  function (this: World, filename: string) {
    const filePath = join(process.cwd(), '.opencode', 'commands', filename);
    const content = readFileSync(filePath, 'utf-8');
    assert.ok(
      content.includes(API_BASE_URL_PATTERN),
      `Command ${filename} does not reference API base URL "${API_BASE_URL_PATTERN}"`
    );
  }
);

Then('every component command file references the API base URL', function (this: World) {
  const violations: string[] = [];
  for (const cmd of COMPONENT_COMMANDS) {
    const filePath = join(process.cwd(), '.opencode', 'commands', cmd);
    const content = readFileSync(filePath, 'utf-8');
    if (!content.includes(API_BASE_URL_PATTERN)) {
      violations.push(cmd);
    }
  }
  assert.equal(
    violations.length,
    0,
    `These command files do not reference the API base URL: ${violations.join(', ')}`
  );
});

Then('no component command file contains {string}', function (this: World, forbidden: string) {
  const violations: string[] = [];
  for (const cmd of COMPONENT_COMMANDS) {
    const filePath = join(process.cwd(), '.opencode', 'commands', cmd);
    const content = readFileSync(filePath, 'utf-8');
    if (content.includes(forbidden)) {
      violations.push(cmd);
    }
  }
  assert.equal(
    violations.length,
    0,
    `These command files still contain "${forbidden}": ${violations.join(', ')}. ` +
      'Commands should use API routes instead of CLI adapter scripts.'
  );
});

// ─── Then (CLI adapter scripts) ─────────────────────────────────────

Given('the project source directory', function (this: World) {
  // No-op — just establishes context
});

Then(
  'a CLI adapter {string} exists in src\\/adapters\\/cli',
  function (this: World, filename: string) {
    const filePath = join(process.cwd(), 'src', 'adapters', 'cli', filename);
    assert.ok(existsSync(filePath), `CLI adapter ${filename} does not exist at ${filePath}`);
  }
);
