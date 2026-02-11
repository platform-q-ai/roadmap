import { Edge } from '@domain/entities/edge.js';
import { describe, expect, it } from 'vitest';

describe('Edge Entity', () => {
  it('creates with required fields', () => {
    const edge = new Edge({ source_id: 'a', target_id: 'b', type: 'CONTROLS' });
    expect(edge.source_id).toBe('a');
    expect(edge.target_id).toBe('b');
    expect(edge.type).toBe('CONTROLS');
  });

  it('defaults optional fields to null', () => {
    const edge = new Edge({ source_id: 'a', target_id: 'b', type: 'CONTROLS' });
    expect(edge.id).toBeNull();
    expect(edge.label).toBeNull();
    expect(edge.metadata).toBeNull();
  });

  it('accepts an explicit id', () => {
    const edge = new Edge({ id: 42, source_id: 'a', target_id: 'b', type: 'CONTROLS' });
    expect(edge.id).toBe(42);
  });

  it('identifies containment edges', () => {
    const contains = new Edge({ source_id: 'a', target_id: 'b', type: 'CONTAINS' });
    const controls = new Edge({ source_id: 'a', target_id: 'b', type: 'CONTROLS' });
    expect(contains.isContainment()).toBe(true);
    expect(controls.isContainment()).toBe(false);
  });

  it('exposes all valid edge types', () => {
    expect(Edge.TYPES).toContain('CONTAINS');
    expect(Edge.TYPES).toContain('CONTROLS');
    expect(Edge.TYPES).toContain('DEPENDS_ON');
    expect(Edge.TYPES).toContain('READS_FROM');
    expect(Edge.TYPES).toContain('WRITES_TO');
    expect(Edge.TYPES).toContain('DISPATCHES_TO');
    expect(Edge.TYPES).toContain('ESCALATES_TO');
    expect(Edge.TYPES).toContain('PROXIES');
    expect(Edge.TYPES).toContain('SANITISES');
    expect(Edge.TYPES).toContain('GATES');
    expect(Edge.TYPES).toContain('SEQUENCE');
  });

  it('produces a plain JSON representation', () => {
    const edge = new Edge({
      id: 1,
      source_id: 'x',
      target_id: 'y',
      type: 'DEPENDS_ON',
      label: 'dep',
      metadata: '{"key":"val"}',
    });
    expect(edge.toJSON()).toEqual({
      id: 1,
      source_id: 'x',
      target_id: 'y',
      type: 'DEPENDS_ON',
      label: 'dep',
      metadata: '{"key":"val"}',
    });
  });
});
