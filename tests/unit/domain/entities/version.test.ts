import { Version } from '@domain/entities/version.js';
import { describe, expect, it } from 'vitest';

describe('Version Entity', () => {
  it('creates with required fields and defaults', () => {
    const ver = new Version({ node_id: 'comp-1', version: 'mvp' });
    expect(ver.node_id).toBe('comp-1');
    expect(ver.version).toBe('mvp');
    expect(ver.id).toBeNull();
    expect(ver.content).toBeNull();
    expect(ver.progress).toBe(0);
    expect(ver.status).toBe('planned');
    expect(ver.updated_at).toBeNull();
  });

  it('accepts all fields explicitly', () => {
    const ver = new Version({
      id: 10,
      node_id: 'comp-1',
      version: 'v1',
      content: 'Spec content',
      progress: 50,
      status: 'in-progress',
      updated_at: '2025-01-01T00:00:00Z',
    });
    expect(ver.id).toBe(10);
    expect(ver.content).toBe('Spec content');
    expect(ver.progress).toBe(50);
    expect(ver.status).toBe('in-progress');
    expect(ver.updated_at).toBe('2025-01-01T00:00:00Z');
  });

  it('identifies complete status', () => {
    const ver = new Version({ node_id: 'c', version: 'mvp', status: 'complete' });
    expect(ver.isComplete()).toBe(true);
    expect(ver.isInProgress()).toBe(false);
  });

  it('identifies in-progress status', () => {
    const ver = new Version({ node_id: 'c', version: 'mvp', status: 'in-progress' });
    expect(ver.isInProgress()).toBe(true);
    expect(ver.isComplete()).toBe(false);
  });

  it('identifies planned status', () => {
    const ver = new Version({ node_id: 'c', version: 'mvp', status: 'planned' });
    expect(ver.isComplete()).toBe(false);
    expect(ver.isInProgress()).toBe(false);
  });

  it('exposes valid version tags', () => {
    expect(Version.VERSIONS).toEqual(['overview', 'mvp', 'v1', 'v2']);
  });

  it('exposes valid statuses', () => {
    expect(Version.STATUSES).toEqual(['planned', 'in-progress', 'complete']);
  });

  it('produces a plain JSON representation', () => {
    const ver = new Version({
      id: 1,
      node_id: 'c',
      version: 'mvp',
      content: 'text',
      progress: 25,
      status: 'in-progress',
      updated_at: '2025-06-01',
    });
    expect(ver.toJSON()).toEqual({
      id: 1,
      node_id: 'c',
      version: 'mvp',
      content: 'text',
      progress: 25,
      status: 'in-progress',
      updated_at: '2025-06-01',
    });
  });
});
