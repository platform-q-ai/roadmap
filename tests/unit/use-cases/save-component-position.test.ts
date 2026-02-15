import { describe, expect, it } from 'vitest';

import { SaveComponentPosition } from '@use-cases/save-component-position.js';
import { InMemoryComponentPositionRepository } from '../../helpers/in-memory-component-position-repository.js';

describe('SaveComponentPosition Use Case', () => {
  it('should save new position', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new SaveComponentPosition({ positionRepo: repo });

    const result = useCase.execute({ componentId: 'app1', x: 100, y: 200 });

    expect(result.componentId).toBe('app1');
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);

    const saved = repo.findByComponentId('app1');
    expect(saved).not.toBeNull();
    expect(saved?.x).toBe(100);
    expect(saved?.y).toBe(200);
  });

  it('should update existing position', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new SaveComponentPosition({ positionRepo: repo });

    useCase.execute({ componentId: 'app1', x: 100, y: 200 });
    const result = useCase.execute({ componentId: 'app1', x: 300, y: 400 });

    expect(result.x).toBe(300);
    expect(result.y).toBe(400);

    const saved = repo.findByComponentId('app1');
    expect(saved?.x).toBe(300);
    expect(saved?.y).toBe(400);
  });

  it('should throw error for invalid componentId', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new SaveComponentPosition({ positionRepo: repo });

    expect(() => {
      useCase.execute({ componentId: '', x: 100, y: 200 });
    }).toThrow('Component ID is required');
  });

  it('should throw error for NaN x coordinate', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new SaveComponentPosition({ positionRepo: repo });

    expect(() => {
      useCase.execute({ componentId: 'app1', x: NaN, y: 200 });
    }).toThrow('Invalid x coordinate');
  });

  it('should throw error for NaN y coordinate', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new SaveComponentPosition({ positionRepo: repo });

    expect(() => {
      useCase.execute({ componentId: 'app1', x: 100, y: NaN });
    }).toThrow('Invalid y coordinate');
  });
});
