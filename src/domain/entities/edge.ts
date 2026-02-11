export type EdgeType =
  | 'CONTAINS'
  | 'CONTROLS'
  | 'DEPENDS_ON'
  | 'READS_FROM'
  | 'WRITES_TO'
  | 'DISPATCHES_TO'
  | 'ESCALATES_TO'
  | 'PROXIES'
  | 'SANITISES'
  | 'GATES'
  | 'SEQUENCE';

export interface EdgeProps {
  id?: number | null;
  source_id: string;
  target_id: string;
  type: EdgeType;
  label?: string | null;
  metadata?: string | null;
}

/**
 * Edge entity — a typed, directed relationship between two nodes.
 */
export class Edge {
  readonly id: number | null;
  readonly source_id: string;
  readonly target_id: string;
  readonly type: EdgeType;
  readonly label: string | null;
  readonly metadata: string | null;

  static readonly TYPES: EdgeType[] = [
    'CONTAINS',
    'CONTROLS',
    'DEPENDS_ON',
    'READS_FROM',
    'WRITES_TO',
    'DISPATCHES_TO',
    'ESCALATES_TO',
    'PROXIES',
    'SANITISES',
    'GATES',
    'SEQUENCE',
  ];

  constructor(props: EdgeProps) {
    this.id = props.id ?? null;
    this.source_id = props.source_id;
    this.target_id = props.target_id;
    this.type = props.type;
    this.label = props.label ?? null;
    this.metadata = props.metadata ?? null;
  }

  isContainment(): boolean {
    return this.type === 'CONTAINS';
  }

  toJSON() {
    return {
      id: this.id,
      source_id: this.source_id,
      target_id: this.target_id,
      type: this.type,
      label: this.label,
      metadata: this.metadata,
    };
  }
}
