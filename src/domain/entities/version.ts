export type VersionTag = 'overview' | 'mvp' | 'v1' | 'v2';
export type VersionStatus = 'planned' | 'in-progress' | 'complete';

export interface VersionProps {
  id?: number | null;
  node_id: string;
  version: VersionTag;
  content?: string | null;
  progress?: number;
  status?: VersionStatus;
  updated_at?: string | null;
}

/**
 * Version entity — versioned documentation for a node.
 *
 * Each node can have overview, mvp, v1, v2 versions.
 * Progress is 0-100, status is planned | in-progress | complete.
 */
export class Version {
  readonly id: number | null;
  readonly node_id: string;
  readonly version: VersionTag;
  readonly content: string | null;
  readonly progress: number;
  readonly status: VersionStatus;
  readonly updated_at: string | null;

  static readonly VERSIONS: VersionTag[] = ['overview', 'mvp', 'v1', 'v2'];
  static readonly STATUSES: VersionStatus[] = ['planned', 'in-progress', 'complete'];

  constructor(props: VersionProps) {
    this.id = props.id ?? null;
    this.node_id = props.node_id;
    this.version = props.version;
    this.content = props.content ?? null;
    this.progress = props.progress ?? 0;
    this.status = props.status ?? 'planned';
    this.updated_at = props.updated_at ?? null;
  }

  isComplete(): boolean {
    return this.status === 'complete';
  }

  isInProgress(): boolean {
    return this.status === 'in-progress';
  }

  toJSON() {
    return {
      id: this.id,
      node_id: this.node_id,
      version: this.version,
      content: this.content,
      progress: this.progress,
      status: this.status,
      updated_at: this.updated_at,
    };
  }
}
