import type { ComponentPosition } from '../entities/component-position.js';

export interface ComponentPositionRepository {
  findByComponentId(componentId: string): ComponentPosition | null;
  findAll(): ComponentPosition[];
  save(position: ComponentPosition): ComponentPosition;
  delete(componentId: string): void;
}
