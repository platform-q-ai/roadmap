export type NodeType = 'layer' | 'component' | 'store' | 'external' | 'phase';

export interface NodeProps {
  id: string;
  name: string;
  type: NodeType;
  layer?: string | null;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  tags?: string | string[];
  sort_order?: number;
}

/**
 * Node entity — a component in the architecture graph.
 *
 * Types: layer, component, store, external, phase
 * A node belongs to a layer (via its `layer` field) and can have
 * versioned documentation, feature files, and typed edges.
 */
export class Node {
  readonly id: string;
  readonly name: string;
  readonly type: NodeType;
  readonly layer: string | null;
  readonly color: string | null;
  readonly icon: string | null;
  readonly description: string | null;
  readonly tags: string[];
  readonly sort_order: number;

  static readonly TYPES: NodeType[] = ['layer', 'component', 'store', 'external', 'phase'];

  constructor(props: NodeProps) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
    this.layer = props.layer ?? null;
    this.color = props.color ?? null;
    this.icon = props.icon ?? null;
    this.description = props.description ?? null;
    this.tags = typeof props.tags === 'string' ? JSON.parse(props.tags) : (props.tags ?? []);
    this.sort_order = props.sort_order ?? 0;
  }

  isLayer(): boolean {
    return this.type === 'layer';
  }

  tagsJson(): string {
    return JSON.stringify(this.tags);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      layer: this.layer,
      color: this.color,
      icon: this.icon,
      description: this.description,
      tags: this.tags,
      sort_order: this.sort_order,
    };
  }
}
