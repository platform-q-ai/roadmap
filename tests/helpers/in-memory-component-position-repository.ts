import type { ComponentPosition } from '@domain/entities/component-position.js';
import type { ComponentPositionRepository } from '@domain/repositories/component-position-repository.js';

export class InMemoryComponentPositionRepository implements ComponentPositionRepository {
  private positions = new Map<string, ComponentPosition>();

  findByComponentId(componentId: string): ComponentPosition | null {
    return this.positions.get(componentId) ?? null;
  }

  findAll(): ComponentPosition[] {
    return Array.from(this.positions.values());
  }

  save(position: ComponentPosition): ComponentPosition {
    this.positions.set(position.componentId, position);
    return position;
  }

  delete(componentId: string): void {
    this.positions.delete(componentId);
  }
}
