import {
  type ComponentPosition,
  createComponentPosition,
} from '../domain/entities/component-position.js';
import { ValidationError } from '../domain/errors.js';
import type { ComponentPositionRepository } from '../domain/repositories/component-position-repository.js';

interface SaveComponentPositionDeps {
  positionRepo: ComponentPositionRepository;
}

interface SaveComponentPositionInput {
  componentId: string;
  x: number;
  y: number;
}

/**
 * Validate component ID format (kebab-case, max 64 chars).
 * Per AGENTS.md: id must be kebab-case, max 64 chars.
 */
function validateComponentId(componentId: string): void {
  if (!componentId || componentId.trim() === '') {
    throw new ValidationError('Component ID is required');
  }

  const trimmed = componentId.trim();

  if (trimmed.length > 64) {
    throw new ValidationError('Component ID must be 64 characters or less');
  }

  // Kebab-case validation: lowercase letters, numbers, hyphens only
  // Must start and end with alphanumeric
  const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!kebabCasePattern.test(trimmed)) {
    throw new ValidationError(
      'Component ID must be kebab-case (lowercase letters, numbers, hyphens)'
    );
  }
}

export class SaveComponentPosition {
  private positionRepo: ComponentPositionRepository;

  constructor(deps: SaveComponentPositionDeps) {
    this.positionRepo = deps.positionRepo;
  }

  execute(input: SaveComponentPositionInput): ComponentPosition {
    // Validate component ID format
    validateComponentId(input.componentId);

    if (typeof input.x !== 'number' || Number.isNaN(input.x)) {
      throw new ValidationError('Invalid x coordinate');
    }

    if (typeof input.y !== 'number' || Number.isNaN(input.y)) {
      throw new ValidationError('Invalid y coordinate');
    }

    const position = createComponentPosition({
      componentId: input.componentId,
      x: input.x,
      y: input.y,
    });

    return this.positionRepo.save(position);
  }
}
