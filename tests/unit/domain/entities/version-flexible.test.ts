import { describe, expect, it } from 'vitest';

import { Version } from '../../../../src/domain/entities/version.js';

describe('Version — flexible version tags', () => {
  it('should accept "v3" as a version tag', () => {
    const version = new Version({ node_id: 'test', version: 'v3' });
    expect(version.version).toBe('v3');
  });

  it('should accept "v4" as a version tag', () => {
    const version = new Version({ node_id: 'test', version: 'v4' });
    expect(version.version).toBe('v4');
  });

  it('should still accept "overview" as a version tag', () => {
    const version = new Version({ node_id: 'test', version: 'overview' });
    expect(version.version).toBe('overview');
  });

  it('should still accept "mvp" as a version tag', () => {
    const version = new Version({ node_id: 'test', version: 'mvp' });
    expect(version.version).toBe('mvp');
  });

  it('should still accept "v1" as a version tag', () => {
    const version = new Version({ node_id: 'test', version: 'v1' });
    expect(version.version).toBe('v1');
  });

  it('should still accept "v2" as a version tag', () => {
    const version = new Version({ node_id: 'test', version: 'v2' });
    expect(version.version).toBe('v2');
  });

  it('should include version in toJSON', () => {
    const version = new Version({ node_id: 'test', version: 'v3', content: 'stuff' });
    expect(version.toJSON().version).toBe('v3');
  });
});
