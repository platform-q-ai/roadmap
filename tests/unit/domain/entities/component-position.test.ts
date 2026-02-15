import { describe, expect, it } from 'vitest';

import { ComponentPosition } from '@domain/entities/component-position.js';

describe('ComponentPosition Entity', () => {
  it('should create with valid data', () => {
    const position = new ComponentPosition({
      componentId: 'app1',
      x: 100,
      y: 200,
    });

    expect(position.componentId).toBe('app1');
    expect(position.x).toBe(100);
    expect(position.y).toBe(200);
  });

  it('should throw error for invalid componentId', () => {
    expect(() => {
      new ComponentPosition({
        componentId: '',
        x: 100,
        y: 200,
      });
    }).toThrow('Component ID is required');
  });

  it('should throw error for NaN x coordinate', () => {
    expect(() => {
      new ComponentPosition({
        componentId: 'app1',
        x: NaN,
        y: 200,
      });
    }).toThrow('Invalid x coordinate');
  });

  it('should throw error for NaN y coordinate', () => {
    expect(() => {
      new ComponentPosition({
        componentId: 'app1',
        x: 100,
        y: NaN,
      });
    }).toThrow('Invalid y coordinate');
  });

  it('should throw error for non-numeric x coordinate', () => {
    expect(() => {
      new ComponentPosition({
        componentId: 'app1',
        x: 'invalid' as unknown as number,
        y: 200,
      });
    }).toThrow('Invalid x coordinate');
  });

  it('should throw error for non-numeric y coordinate', () => {
    expect(() => {
      new ComponentPosition({
        componentId: 'app1',
        x: 100,
        y: 'invalid' as unknown as number,
      });
    }).toThrow('Invalid y coordinate');
  });

  it('should allow zero coordinates', () => {
    const position = new ComponentPosition({
      componentId: 'app1',
      x: 0,
      y: 0,
    });

    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
  });

  it('should allow negative coordinates', () => {
    const position = new ComponentPosition({
      componentId: 'app1',
      x: -100,
      y: -200,
    });

    expect(position.x).toBe(-100);
    expect(position.y).toBe(-200);
  });

  it('should allow decimal coordinates', () => {
    const position = new ComponentPosition({
      componentId: 'app1',
      x: 100.5,
      y: 200.75,
    });

    expect(position.x).toBe(100.5);
    expect(position.y).toBe(200.75);
  });
});
