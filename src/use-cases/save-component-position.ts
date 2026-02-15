import {
  type ComponentPosition,
  createComponentPosition,
} from '../domain/entities/component-position.js';
import type { ComponentPositionRepository } from '../domain/repositories/component-position-repository.js';

interface SaveComponentPositionDeps {
  positionRepo: ComponentPositionRepository;
}

interface SaveComponentPositionInput {
  componentId: string;
  x: number;
  y: number;
}

export class SaveComponentPosition {
  private positionRepo: ComponentPositionRepository;

  constructor(deps: SaveComponentPositionDeps) {
    this.positionRepo = deps.positionRepo;
  }

  execute(input: SaveComponentPositionInput): ComponentPosition {
    if (!input.componentId || input.componentId.trim() === '') {
      throw new Error('Component ID is required');
    }

    if (typeof input.x !== 'number' || Number.isNaN(input.x)) {
      throw new Error('Invalid x coordinate');
    }

    if (typeof input.y !== 'number' || Number.isNaN(input.y)) {
      throw new Error('Invalid y coordinate');
    }

    const position = createComponentPosition({
      componentId: input.componentId,
      x: input.x,
      y: input.y,
    });

    return this.positionRepo.save(position);
  }
}
