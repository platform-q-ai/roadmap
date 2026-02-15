import { describe, expect, it } from 'vitest';

import { DeleteComponentPosition } from '@use-cases/delete-component-position.js';
import { InMemoryComponentPositionRepository } from '../../helpers/in-memory-component-position-repository.js';

describe('DeleteComponentPosition Use Case', () => {
  it('should delete existing position', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new DeleteComponentPosition({ positionRepo: repo });

    repo.save({ componentId: 'app1', x: 100, y: 200 });

    useCase.execute({ componentId: 'app1' });

    const saved = repo.findByComponentId('app1');
    expect(saved).toBeNull();
  });

  it('should not throw error for non-existing component', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new DeleteComponentPosition({ positionRepo: repo });

    expect(() => {
      useCase.execute({ componentId: 'nonexistent' });
    }).not.toThrow();
  });

  it('should throw error for missing componentId', () => {
    const repo = new InMemoryComponentPositionRepository();
    const useCase = new DeleteComponentPosition({ positionRepo: repo });

    expect(() => {
      useCase.execute({ componentId: '' });
    }).toThrow('Component ID is required');
  });
});
