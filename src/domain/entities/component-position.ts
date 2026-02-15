export interface ComponentPositionData {
  componentId: string;
  x: number;
  y: number;
}

export class ComponentPosition {
  componentId: string;
  x: number;
  y: number;

  constructor(data: ComponentPositionData) {
    this.validate(data);
    this.componentId = data.componentId.trim();
    this.x = data.x;
    this.y = data.y;
  }

  private validate(data: ComponentPositionData): void {
    if (!data.componentId || data.componentId.trim() === '') {
      throw new Error('Component ID is required');
    }

    if (typeof data.x !== 'number' || Number.isNaN(data.x)) {
      throw new Error('Invalid x coordinate');
    }

    if (typeof data.y !== 'number' || Number.isNaN(data.y)) {
      throw new Error('Invalid y coordinate');
    }
  }
}

export function createComponentPosition(data: ComponentPositionData): ComponentPosition {
  return new ComponentPosition(data);
}
