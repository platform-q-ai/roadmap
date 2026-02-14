export type NodeType = 'layer' | 'component' | 'store' | 'external' | 'phase' | 'app' | 'mcp';

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
  current_version?: string | null;
}

/**
 * Node entity — a component in the architecture graph.
 *
 * Types: layer, component, store, external, phase, app, mcp
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
  readonly current_version: string | null;

  static readonly TYPES: NodeType[] = [
    'layer',
    'component',
    'store',
    'external',
    'phase',
    'app',
    'mcp',
  ];

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
    this.current_version = props.current_version ?? null;
  }

  isLayer(): boolean {
    return this.type === 'layer';
  }

  isApp(): boolean {
    return this.type === 'app' || this.type === 'mcp';
  }

  /**
   * Compute display state from current_version:
   * - null → "Concept"
   * - < 1.0.0 → "MVP"
   * - >= 1.0.0 → "vN" (major version)
   */
  displayState(): string {
    if (!this.current_version) {
      return 'Concept';
    }
    const major = parseInt(this.current_version.split('.')[0], 10);
    if (isNaN(major) || major < 1) {
      return 'MVP';
    }
    return `v${major}`;
  }

  /**
   * Visual state for progression tree rendering:
   * - null → "locked" (Concept — greyed out)
   * - < 1.0.0 → "in-progress" (MVP — partially lit)
   * - >= 1.0.0 → "complete" (released — fully lit)
   */
  visualState(): string {
    if (!this.current_version) {
      return 'locked';
    }
    const major = parseInt(this.current_version.split('.')[0], 10);
    if (isNaN(major) || major < 1) {
      return 'in-progress';
    }
    return 'complete';
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
      current_version: this.current_version,
    };
  }
}
