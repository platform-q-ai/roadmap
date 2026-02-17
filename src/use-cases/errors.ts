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

export class EdgeNotFoundError extends Error {
  constructor(id: number) {
    super(`Edge not found: ${id}`);
    this.name = 'EdgeNotFoundError';
  }
}

export class EdgeExistsError extends Error {
  constructor(sourceId: string, targetId: string, type: string) {
    super(`Edge already exists: ${sourceId} -> ${targetId} (${type})`);
    this.name = 'EdgeExistsError';
  }
}

export class VersionNotFoundError extends Error {
  constructor(nodeId: string, version: string) {
    super(`Version not found: ${version} for component ${nodeId}`);
    this.name = 'VersionNotFoundError';
  }
}

// ValidationError is defined in ../domain/errors.ts (single source of truth).
// Use-case files should import it from '../domain/index.js' (the barrel).
