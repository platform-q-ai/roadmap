import { Given } from '@cucumber/cucumber';

import type { EdgeType } from '../../src/domain/entities/edge.js';
import { Edge } from '../../src/domain/entities/edge.js';
import { Node } from '../../src/domain/entities/node.js';

/**
 * Shared step definitions used by multiple feature files.
 * Keeps Cucumber from encountering ambiguous matches.
 */

interface CommonWorld {
  nodes: Node[];
  edges: Edge[];
  [key: string]: unknown;
}

Given('a component node {string} exists', function (this: CommonWorld, id: string) {
  if (!this.nodes) {
    this.nodes = [];
  }
  if (!this.nodes.some(n => n.id === id)) {
    this.nodes.push(new Node({ id, name: id, type: 'component' }));
  }
});

Given('no node with id {string} exists', function (this: CommonWorld, id: string) {
  if (!this.nodes) {
    this.nodes = [];
  }
  this.nodes = this.nodes.filter(n => n.id !== id);
});

Given(
  'a {string} edge from {string} to {string}',
  function (this: CommonWorld, type: string, source: string, target: string) {
    if (!this.edges) {
      this.edges = [];
    }
    const nextId = this.edges.length + 1;
    this.edges.push(
      new Edge({ id: nextId, source_id: source, target_id: target, type: type as EdgeType })
    );
  }
);
