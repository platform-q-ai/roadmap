import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import type { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import type { NodeType } from '../../src/domain/entities/node.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type { ArchitectureData } from '../../src/use-cases/get-architecture.js';
import { GetArchitecture } from '../../src/use-cases/get-architecture.js';
import { buildRepos } from '../helpers/build-repos.js';

interface World {
  node: Node;
  version: Version;
  feature: Feature;
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  result: ArchitectureData;
  derivedVersion: string;
  savedVersionTag: string;
  savedNode: Node | null;
  [key: string]: unknown;
}

// ─── Background ──────────────────────────────────────────────────────

Given('an architecture graph with nodes and versions', function (this: World) {
  this.nodes = [];
  this.edges = [];
  this.versions = [];
  this.features = [];
});

// ─── Domain: Node entity with current_version ────────────────────────

Given('a node with id {string} and no current_version', function (this: World, id: string) {
  this.node = new Node({ id, name: id, type: 'component' });
});

Given(
  'a node with id {string} and current_version {string}',
  function (this: World, id: string, version: string) {
    this.node = new Node({ id, name: id, type: 'component', current_version: version });
  }
);

Given(
  'a node with id {string} and type {string}',
  function (this: World, id: string, type: string) {
    this.node = new Node({ id, name: id, type: type as NodeType });
  }
);

Then('the node display state should be {string}', function (this: World, expected: string) {
  assert.equal(this.node.displayState(), expected);
});

Then('the node display version should be {string}', function (this: World, expected: string) {
  assert.equal(this.node.current_version, expected);
});

Then('the node type should be {string}', function (this: World, expected: string) {
  assert.equal(this.node.type, expected);
});

Then('the node should be valid', function (this: World) {
  assert.ok(this.node.id);
  assert.ok(this.node.name);
  assert.ok(Node.TYPES.includes(this.node.type));
});

// ─── Domain: Version entity with flexible tags ───────────────────────

Given('a version with version tag {string}', function (this: World, tag: string) {
  this.version = new Version({ node_id: 'test', version: tag });
});

Then('the version should be valid', function (this: World) {
  assert.ok(this.version.node_id);
  assert.ok(this.version.version);
});

// ─── Domain: Feature entity with flexible version derivation ─────────

Given('a feature file named {string}', function (this: World, filename: string) {
  this.derivedVersion = Feature.versionFromFilename(filename);
});

Then('the derived version should be {string}', function (this: World, expected: string) {
  assert.equal(this.derivedVersion, expected);
});

// ─── Use Case: GetArchitecture with version state ────────────────────

Given(
  'a node {string} with current_version {string} exists in the database',
  function (this: World, id: string, version: string) {
    this.nodes.push(new Node({ id, name: id, type: 'app', current_version: version }));
  }
);

Given(
  'a node {string} with no current_version exists in the database',
  function (this: World, id: string) {
    this.nodes.push(new Node({ id, name: id, type: 'app' }));
  }
);

When('I assemble the architecture', async function (this: World) {
  const repos = buildRepos(this);
  const useCase = new GetArchitecture(repos);
  this.result = await useCase.execute();
});

Then(
  'the enriched node {string} should have current_version {string}',
  function (this: World, id: string, version: string) {
    const node = this.result.nodes.find(n => n.id === id);
    assert.ok(node, `Node ${id} not found`);
    assert.equal(node.current_version, version);
  }
);

Then(
  'the enriched node {string} should have display_state {string}',
  function (this: World, id: string, state: string) {
    const node = this.result.nodes.find(n => n.id === id);
    assert.ok(node, `Node ${id} not found`);
    assert.equal(node.display_state, state);
  }
);

// ─── Schema: flexible version tags + current_version ─────────────────

Given('a node {string} exists in the database', function (this: World, id: string) {
  this.nodes.push(new Node({ id, name: id, type: 'component' }));
});

When(
  'I save a version with tag {string} for node {string}',
  function (this: World, tag: string, _nodeId: string) {
    this.version = new Version({ node_id: _nodeId, version: tag, content: 'test' });
    this.savedVersionTag = tag;
  }
);

Then('the version should be persisted successfully', function (this: World) {
  assert.ok(this.version);
  assert.equal(this.version.version, this.savedVersionTag);
});

Given(
  'a node {string} with current_version {string} is saved',
  function (this: World, id: string, version: string) {
    this.node = new Node({ id, name: id, type: 'component', current_version: version });
  }
);

When('I retrieve the node {string}', function (this: World, _id: string) {
  this.savedNode = this.node;
});

Then('the node current_version should be {string}', function (this: World, expected: string) {
  assert.ok(this.savedNode);
  assert.equal(this.savedNode.current_version, expected);
});
