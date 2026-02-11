import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import type { EdgeProps, EdgeType } from '../../src/domain/entities/edge.js';
import { Edge } from '../../src/domain/entities/edge.js';
import { Feature } from '../../src/domain/entities/feature.js';
import type { NodeProps, NodeType } from '../../src/domain/entities/node.js';
import { Node } from '../../src/domain/entities/node.js';
import type { VersionProps, VersionStatus, VersionTag } from '../../src/domain/entities/version.js';
import { Version } from '../../src/domain/entities/version.js';

interface World {
  nodeProps: NodeProps;
  node: Node;
  edgeProps: EdgeProps;
  edge: Edge;
  versionProps: VersionProps;
  version: Version;
}

// ─── Node creation ──────────────────────────────────────────────────

Given(
  'node properties with id {string}, name {string}, and type {string}',
  function (this: World, id: string, name: string, type: string) {
    this.nodeProps = { id, name, type: type as NodeType };
  }
);

Given('node properties with tags stored as JSON', function (this: World) {
  this.nodeProps = {
    id: 'tag-node',
    name: 'Tag Node',
    type: 'component',
    tags: '["runtime","core"]',
  };
});

Given('node properties with tags provided as array', function (this: World) {
  this.nodeProps = { id: 'tag-node', name: 'Tag Node', type: 'component', tags: ['alpha', 'beta'] };
});

Given('node properties with only required fields', function (this: World) {
  this.nodeProps = { id: 'min-node', name: 'Minimal', type: 'component' };
});

Given('node properties with type {string}', function (this: World, type: string) {
  this.nodeProps = { id: 'typed-node', name: 'Typed', type: type as NodeType };
});

When('I create the Node entity', function (this: World) {
  this.node = new Node(this.nodeProps as ConstructorParameters<typeof Node>[0]);
});

Then('the node has id {string}', function (this: World, id: string) {
  assert.equal(this.node.id, id);
});

Then('the node has name {string}', function (this: World, name: string) {
  assert.equal(this.node.name, name);
});

Then('the node has type {string}', function (this: World, type: string) {
  assert.equal(this.node.type, type);
});

Then(
  'the node has parsed tags {string} and {string}',
  function (this: World, tag1: string, tag2: string) {
    assert.deepEqual(this.node.tags, [tag1, tag2]);
  }
);

Then('the node layer is null', function (this: World) {
  assert.equal(this.node.layer, null);
});

Then('the node color is null', function (this: World) {
  assert.equal(this.node.color, null);
});

Then('the node icon is null', function (this: World) {
  assert.equal(this.node.icon, null);
});

Then('the node description is null', function (this: World) {
  assert.equal(this.node.description, null);
});

Then('the node tags are an empty array', function (this: World) {
  assert.deepEqual(this.node.tags, []);
});

Then('the node sort_order is {int}', function (this: World, order: number) {
  assert.equal(this.node.sort_order, order);
});

Then('the node reports it is a layer', function (this: World) {
  assert.equal(this.node.isLayer(), true);
});

// ─── Edge creation ──────────────────────────────────────────────────

Given(
  'edge properties with source {string}, target {string}, and type {string}',
  function (this: World, source: string, target: string, type: string) {
    this.edgeProps = { source_id: source, target_id: target, type: type as EdgeType };
  }
);

Given('edge properties with type {string}', function (this: World, type: string) {
  this.edgeProps = { source_id: 'a', target_id: 'b', type: type as EdgeType };
});

When('I create the Edge entity', function (this: World) {
  this.edge = new Edge(this.edgeProps as ConstructorParameters<typeof Edge>[0]);
});

Then(
  'the edge has source_id {string} and target_id {string}',
  function (this: World, source: string, target: string) {
    assert.equal(this.edge.source_id, source);
    assert.equal(this.edge.target_id, target);
  }
);

Then('the edge has type {string}', function (this: World, type: string) {
  assert.equal(this.edge.type, type);
});

Then('the edge reports it is a containment edge', function (this: World) {
  assert.equal(this.edge.isContainment(), true);
});

Then('the edge reports it is not a containment edge', function (this: World) {
  assert.equal(this.edge.isContainment(), false);
});

// ─── Version creation ───────────────────────────────────────────────

Given(
  'version properties with node_id {string} and version {string}',
  function (this: World, nodeId: string, version: string) {
    this.versionProps = { node_id: nodeId, version: version as VersionTag };
  }
);

Given('a version with status {string}', function (this: World, status: string) {
  this.versionProps = {
    node_id: 'check-node',
    version: 'mvp' as VersionTag,
    status: status as VersionStatus,
  };
});

When('I create the Version entity', function (this: World) {
  this.version = new Version(
    this.versionProps as { node_id: string; version: VersionTag; status?: VersionStatus }
  );
});

When('I check the version status', function (this: World) {
  this.version = new Version(
    this.versionProps as { node_id: string; version: VersionTag; status?: VersionStatus }
  );
});

Then('the version progress is {int}', function (this: World, progress: number) {
  assert.equal(this.version.progress, progress);
});

Then('the version status is {string}', function (this: World, status: string) {
  assert.equal(this.version.status, status);
});

Then('the version content is null', function (this: World) {
  assert.equal(this.version.content, null);
});

Then('isComplete returns true', function (this: World) {
  assert.equal(this.version.isComplete(), true);
});

Then('isInProgress returns false', function (this: World) {
  assert.equal(this.version.isInProgress(), false);
});

Then('isInProgress returns true', function (this: World) {
  assert.equal(this.version.isInProgress(), true);
});

Then('isComplete returns false', function (this: World) {
  assert.equal(this.version.isComplete(), false);
});

// ─── Feature static methods ─────────────────────────────────────────

Then('version for filename {string} is {string}', function (_filename: string, expected: string) {
  assert.equal(Feature.versionFromFilename(_filename), expected);
});

Then('the title extracted from a Feature line is {string}', function (expected: string) {
  const content = 'Feature: My Cool Feature\n  Scenario: test';
  assert.equal(Feature.titleFromContent(content, 'fallback.feature'), expected);
});

Then(
  'the title falls back to filename {string} giving {string}',
  function (fallback: string, expected: string) {
    assert.equal(Feature.titleFromContent('No feature line here', fallback), expected);
  }
);
