import { strict as assert } from 'node:assert';

import { Given, Then } from '@cucumber/cucumber';

import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';

interface ApiWorld {
  nodes: Node[];
  edges: unknown[];
  versions: Version[];
  features: unknown[];
  server: unknown;
  baseUrl: string;
  response: { status: number; body: unknown; headers: Record<string, string> } | null;
  [key: string]: unknown;
}

// ─── Given: component setup ─────────────────────────────────────────

Given('a component {string} exists', function (this: ApiWorld, id: string) {
  if (!this.nodes) {
    this.nodes = [];
  }
  if (!this.nodes.some(n => n.id === id)) {
    this.nodes.push(
      new Node({ id, name: `Component ${id}`, type: 'component', layer: 'supervisor-layer' })
    );
  }
});

Given(
  'a component {string} exists with tags [{string}]',
  function (this: ApiWorld, id: string, tagList: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    const tags = tagList.split(',').map(t => t.trim().replace(/"/g, ''));
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.nodes.push(
      new Node({ id, name: `Component ${id}`, type: 'component', layer: 'supervisor-layer', tags })
    );
  }
);

Given(
  'a component {string} exists with sort_order {int}',
  function (this: ApiWorld, id: string, sortOrder: number) {
    if (!this.nodes) {
      this.nodes = [];
    }
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.nodes.push(
      new Node({
        id,
        name: `Component ${id}`,
        type: 'component',
        layer: 'supervisor-layer',
        sort_order: sortOrder,
      })
    );
  }
);

Given(
  'a component {string} exists with current_version null',
  function (this: ApiWorld, id: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.nodes.push(
      new Node({
        id,
        name: `Component ${id}`,
        type: 'component',
        layer: 'supervisor-layer',
        current_version: null,
      })
    );
  }
);

Given(
  'a component {string} exists with version {string} at progress {int}',
  function (this: ApiWorld, id: string, versionTag: string, progress: number) {
    if (!this.nodes) {
      this.nodes = [];
    }
    if (!this.versions) {
      this.versions = [];
    }
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.nodes.push(
      new Node({
        id,
        name: `Component ${id}`,
        type: 'component',
        layer: 'supervisor-layer',
        current_version: null,
      })
    );
    this.versions = this.versions.filter(v => !(v.node_id === id && v.version === versionTag));
    this.versions.push(
      new Version({
        node_id: id,
        version: versionTag,
        content: `${versionTag} content`,
        progress,
        status: Version.deriveStatus(progress),
      })
    );
  }
);

Given(
  'a component {string} exists with name {string} and description {string}',
  function (this: ApiWorld, id: string, name: string, description: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.nodes.push(
      new Node({
        id,
        name,
        type: 'component',
        layer: 'supervisor-layer',
        description,
      })
    );
  }
);

// ─── Then: assertions ───────────────────────────────────────────────

Then(
  'the response body has field {string} containing {string} and {string}',
  function (this: ApiWorld, field: string, val1: string, val2: string) {
    assert.ok(this.response, 'No response received');
    const body = this.response.body as Record<string, unknown>;
    assert.ok(field in body, `Field "${field}" not found in response body`);
    const arr = body[field];
    assert.ok(Array.isArray(arr), `Expected "${field}" to be an array`);
    const values = arr as string[];
    assert.ok(
      values.includes(val1),
      `Expected "${field}" to contain "${val1}", got ${JSON.stringify(values)}`
    );
    assert.ok(
      values.includes(val2),
      `Expected "${field}" to contain "${val2}", got ${JSON.stringify(values)}`
    );
  }
);

Then(
  'the version {string} for {string} now has derived progress {int}',
  async function (this: ApiWorld, versionTag: string, nodeId: string, expectedProgress: number) {
    assert.ok(this.versions, 'No versions in world');
    const version = this.versions.find(v => v.node_id === nodeId && v.version === versionTag);
    assert.ok(
      version,
      `Version "${versionTag}" for node "${nodeId}" not found. Available: ${this.versions.map(v => `${v.node_id}/${v.version}`).join(', ')}`
    );
    assert.equal(
      version.progress,
      expectedProgress,
      `Expected derived progress ${expectedProgress} for ${versionTag}/${nodeId}, got ${version.progress}`
    );
  }
);
