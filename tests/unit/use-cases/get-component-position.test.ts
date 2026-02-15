import { describe, expect, it } from 'vitest';

import { GetComponentPosition } from '@use-cases/get-component-position.js';
import { InMemoryComponentPositionRepository } from '../../helpers/in-memory-component-position-repository.js';

describe('GetComponentPosition Use Case', () => {
  it('should return position for existing component', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new GetComponentPosition({ positionRepo: repo });

    repo.save({ componentId: 'app1', x: 100, y: 200 });

    const result = useCase.execute({ componentId: 'app1' });

    expect(result).not.toBeNull();
    expect(result?.componentId).toBe('app1');
    expect(result?.x).toBe(100);
    expect(result?.y).toBe(200);
  });

  it('should return null for non-existing component', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new GetComponentPosition({ positionRepo: repo });

    const result = useCase.execute({ componentId: 'nonexistent' });

    expect(result).toBeNull();
  });

  it('should throw error for missing componentId', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new GetComponentPosition({ positionRepo: repo });

    expect(() => {
      useCase.execute({ componentId: '' });
    }).toThrow('Component ID is required');
  });
});
