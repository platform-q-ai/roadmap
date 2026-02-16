import { ValidationError } from '../domain/errors.js';
import type { ComponentPositionRepository } from '../domain/repositories/component-position-repository.js';

interface DeleteComponentPositionDeps {
  positionRepo: ComponentPositionRepository;
}

interface DeleteComponentPositionInput {
  componentId: string;
}

export class DeleteComponentPosition {
  private positionRepo: ComponentPositionRepository;

  constructor(deps: DeleteComponentPositionDeps) {
    this.positionRepo = deps.positionRepo;
  }

  execute(input: DeleteComponentPositionInput): void {
    if (!input.componentId || input.componentId.trim() === '') {
      throw new ValidationError('Component ID is required');
    }

    this.positionRepo.delete(input.componentId);
  }
}
