import { describe, expect, it } from 'vitest';

import { Node } from '../../../../src/domain/entities/node.js';

describe('Node — current_version and display state', () => {
  it('should store current_version from props', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component', current_version: '0.3.0' });
    expect(node.current_version).toBe('0.3.0');
  });

  it('should default current_version to null', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component' });
    expect(node.current_version).toBeNull();
  });

  it('should return "Concept" for null current_version', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component' });
    expect(node.displayState()).toBe('Concept');
  });

  it('should return "MVP" for version < 1.0.0', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component', current_version: '0.1.0' });
    expect(node.displayState()).toBe('MVP');
  });

  it('should return "MVP" for version 0.99.99', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component', current_version: '0.99.99' });
    expect(node.displayState()).toBe('MVP');
  });

  it('should return "v1" for version 1.0.0', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component', current_version: '1.0.0' });
    expect(node.displayState()).toBe('v1');
  });

  it('should return "v1" for version 1.5.3', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component', current_version: '1.5.3' });
    expect(node.displayState()).toBe('v1');
  });

  it('should return "v2" for version 2.0.0', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component', current_version: '2.0.0' });
    expect(node.displayState()).toBe('v2');
  });

  it('should return "v10" for version 10.0.0', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component', current_version: '10.0.0' });
    expect(node.displayState()).toBe('v10');
  });

  it('should include current_version in toJSON', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component', current_version: '1.0.0' });
    const json = node.toJSON();
    expect(json.current_version).toBe('1.0.0');
  });

  it('should include null current_version in toJSON', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component' });
    const json = node.toJSON();
    expect(json.current_version).toBeNull();
  });
});

describe('Node — app type', () => {
  it('should accept "app" as a valid node type', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'app' });
    expect(node.type).toBe('app');
  });

  it('should include "app" in TYPES', () => {
    expect(Node.TYPES).toContain('app');
  });

  it('should not be a layer when type is app', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'app' });
    expect(node.isLayer()).toBe(false);
  });

  it('should support isApp method', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'app' });
    expect(node.isApp()).toBe(true);
  });

  it('should return false for isApp on non-app types', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'component' });
    expect(node.isApp()).toBe(false);
  });
});

describe('Node — visualState', () => {
  it('should return "locked" for null current_version', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'app' });
    expect(node.visualState()).toBe('locked');
  });

  it('should return "in-progress" for version < 1.0.0', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'app', current_version: '0.5.0' });
    expect(node.visualState()).toBe('in-progress');
  });

  it('should return "complete" for version >= 1.0.0', () => {
    const node = new Node({ id: 'a', name: 'A', type: 'app', current_version: '1.0.0' });
    expect(node.visualState()).toBe('complete');
  });
});
