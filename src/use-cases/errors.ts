/**
 * Shared domain error classes for use cases.
 *
 * Centralised here to avoid duplication across use case files.
 * All extend Error with a descriptive `name` property for easy
 * identification in error-handling middleware.
 */

export class NodeNotFoundError extends Error {
  constructor(id: string) {
    super(`Node not found: ${id}`);
    this.name = 'NodeNotFoundError';
  }
}

export class FeatureNotFoundError extends Error {
  constructor(nodeId: string, filename: string) {
    super(`Feature not found: ${filename} for component ${nodeId}`);
    this.name = 'FeatureNotFoundError';
  }
}

export class NodeTypeError extends Error {
  constructor(type: string) {
    super(`Invalid node type: ${type}`);
    this.name = 'NodeTypeError';
  }
}

export class NodeExistsError extends Error {
  constructor(id: string) {
    super(`Node already exists: ${id}`);
    this.name = 'NodeExistsError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
