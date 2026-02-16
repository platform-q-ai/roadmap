import type { ComponentPosition } from '../domain/entities/component-position.js';
import { ValidationError } from '../domain/errors.js';
import type { ComponentPositionRepository } from '../domain/repositories/component-position-repository.js';

interface GetComponentPositionDeps {
  positionRepo: ComponentPositionRepository;
}

interface GetComponentPositionInput {
  componentId: string;
}

export class GetComponentPosition {
  private positionRepo: ComponentPositionRepository;

  constructor(deps: GetComponentPositionDeps) {
    this.positionRepo = deps.positionRepo;
  }

  execute(input: GetComponentPositionInput): ComponentPosition | null {
    if (!input.componentId || input.componentId.trim() === '') {
      throw new ValidationError('Component ID is required');
    }

    return this.positionRepo.findByComponentId(input.componentId);
  }
}
