import { Node } from '@domain/entities/node.js';
import { describe, expect, it } from 'vitest';

describe('Node Entity', () => {
  it('creates with required fields', () => {
    const node = new Node({ id: 'test', name: 'Test', type: 'component' });
    expect(node.id).toBe('test');
    expect(node.name).toBe('Test');
    expect(node.type).toBe('component');
  });

  it('defaults optional fields to null or zero', () => {
    const node = new Node({ id: 'n', name: 'N', type: 'component' });
    expect(node.layer).toBeNull();
    expect(node.color).toBeNull();
    expect(node.icon).toBeNull();
    expect(node.description).toBeNull();
    expect(node.tags).toEqual([]);
    expect(node.sort_order).toBe(0);
  });

  it('parses tags from a JSON string', () => {
    const node = new Node({
      id: 'n',
      name: 'N',
      type: 'component',
      tags: '["alpha","beta"]',
    });
    expect(node.tags).toEqual(['alpha', 'beta']);
  });

  it('accepts tags as an array', () => {
    const node = new Node({
      id: 'n',
      name: 'N',
      type: 'component',
      tags: ['x', 'y'],
    });
    expect(node.tags).toEqual(['x', 'y']);
  });

  it('serializes tags back to JSON', () => {
    const node = new Node({
      id: 'n',
      name: 'N',
      type: 'component',
      tags: ['a'],
    });
    expect(node.tagsJson()).toBe('["a"]');
  });

  it('identifies layer nodes', () => {
    const layer = new Node({ id: 'l', name: 'L', type: 'layer' });
    const comp = new Node({ id: 'c', name: 'C', type: 'component' });
    expect(layer.isLayer()).toBe(true);
    expect(comp.isLayer()).toBe(false);
  });

  it('exposes valid node types', () => {
    expect(Node.TYPES).toContain('layer');
    expect(Node.TYPES).toContain('component');
    expect(Node.TYPES).toContain('store');
    expect(Node.TYPES).toContain('external');
    expect(Node.TYPES).toContain('phase');
  });

  it('produces a plain JSON representation', () => {
    const node = new Node({
      id: 'j',
      name: 'JSON',
      type: 'component',
      layer: 'layer-1',
      color: '#fff',
      icon: 'icon',
      description: 'desc',
      tags: ['t'],
      sort_order: 5,
    });
    const json = node.toJSON();
    expect(json).toEqual({
      id: 'j',
      name: 'JSON',
      type: 'component',
      layer: 'layer-1',
      color: '#fff',
      icon: 'icon',
      description: 'desc',
      tags: ['t'],
      sort_order: 5,
      current_version: null,
    });
  });
});
