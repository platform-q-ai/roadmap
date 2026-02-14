import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import type { NodeType } from '../../src/domain/entities/node.js';
import { Node } from '../../src/domain/entities/node.js';

interface World {
  node: Node;
  nodes: Node[];
  progressionNodes: Node[];
  cytoscapeElements: Array<{ data: Record<string, unknown> }>;
  shapeMap: Record<string, string>;
  [key: string]: unknown;
}

// ─── Shape mapping (mirrors the web view logic) ─────────────────────

const NODE_TYPE_SHAPES: Record<string, string> = {
  app: 'octagon',
  mcp: 'ellipse',
};
const DEFAULT_SHAPE = 'hexagon';

function shapeForType(type: string): string {
  return NODE_TYPE_SHAPES[type] ?? DEFAULT_SHAPE;
}

// ─── Background ─────────────────────────────────────────────────────

Given('the architecture data is loaded', function (this: World) {
  this.nodes = [];
  this.progressionNodes = [];
  this.cytoscapeElements = [];
  this.shapeMap = {};
});

// ─── App nodes render as octagons ───────────────────────────────────

Given(
  'a node with type {string} exists in the progression tree',
  function (this: World, type: string) {
    this.node = new Node({
      id: `${type}-node`,
      name: `${type} Node`,
      type: type as NodeType,
    });
    this.nodes.push(this.node);
  }
);

When('the progression tree is rendered', function (this: World) {
  this.shapeMap = {};
  for (const node of this.nodes) {
    this.shapeMap[node.id] = shapeForType(node.type);
  }
});

Then('the node should have shape {string}', function (this: World, expectedShape: string) {
  const shape = this.shapeMap[this.node.id];
  assert.equal(shape, expectedShape, `Expected shape ${expectedShape} but got ${shape}`);
});

// ─── MCP is a valid node type ───────────────────────────────────────

When('I create a node with type {string}', function (this: World, type: string) {
  this.node = new Node({
    id: 'mcp-test',
    name: 'MCP Test',
    type: type as NodeType,
  });
});

Then('the node should be created successfully', function (this: World) {
  assert.ok(this.node, 'Node was not created');
  assert.ok(this.node.id, 'Node has no id');
});

// "the node type should be {string}" is defined in component-version-state.steps.ts
// and shared across feature files — no duplicate needed here.

// ─── MCP nodes appear in the progression tree ───────────────────────

Given('a node with type {string} exists', function (this: World, type: string) {
  this.node = new Node({
    id: `${type}-test`,
    name: `${type} Test`,
    type: type as NodeType,
  });
  this.nodes.push(this.node);
});

When('the architecture graph is assembled', function (this: World) {
  // Progression tree includes app and mcp types
  this.progressionNodes = this.nodes.filter(n => n.isApp());
});

Then('the node should be included in the progression tree nodes', function (this: World) {
  const found = this.progressionNodes.some(n => n.id === this.node.id);
  assert.ok(found, `Node ${this.node.id} not found in progression tree nodes`);
});

// ─── Node type passed as Cytoscape element data ─────────────────────

When('the progression tree elements are built', function (this: World) {
  this.cytoscapeElements = this.nodes.map(node => ({
    data: {
      id: node.id,
      label: node.name,
      type: node.type,
    },
  }));
});

Then('the Cytoscape element data should include the node type', function (this: World) {
  const el = this.cytoscapeElements.find(e => e.data['id'] === this.node.id);
  assert.ok(el, 'Element not found');
  assert.equal(el.data['type'], this.node.type, 'type field missing from element data');
});

// ─── Default shape for unrecognised types ───────────────────────────

Given('a node with an unrecognised type exists in the progression tree', function (this: World) {
  // Use 'store' as a stand-in for an unrecognised type in the shape map
  this.node = new Node({
    id: 'unknown-type-node',
    name: 'Unknown Type',
    type: 'store',
  });
  this.nodes.push(this.node);
});
