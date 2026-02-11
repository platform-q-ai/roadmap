export type VersionTag = string;
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
 * Each node can have arbitrary version tags (overview, mvp, v1, v2, v3, etc.).
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

  static readonly VERSIONS: string[] = ['overview', 'mvp', 'v1', 'v2'];
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

  /**
   * Phase-to-major mapping for version-derived progress.
   * mvp = major 0, v1 = major 1, v2 = major 2.
   */
  private static readonly PHASE_MAJOR: Record<string, number> = {
    mvp: 0,
    v1: 1,
    v2: 2,
  };

  /**
   * Check whether a version tag is a recognised phase tag (mvp, v1, v2).
   */
  static isPhaseTag(tag: string): boolean {
    return tag in Version.PHASE_MAJOR;
  }

  /**
   * Derive phase progress from a node's current_version semver string.
   *
   * Each version tag (mvp, v1, v2) maps to a major version number.
   * The minor digit of current_version * 10 = progress % for the active phase.
   * Completed phases (major > phase major) = 100%.
   * Future phases (major < phase major) = 0%.
   * Unrecognised tags (overview, v3, etc.) return 0.
   */
  static deriveProgress(currentVersion: string | null, versionTag: string): number {
    if (!currentVersion) {
      return 0;
    }

    const phaseMajor = Version.PHASE_MAJOR[versionTag];
    if (phaseMajor === undefined) {
      return 0;
    }

    const parts = currentVersion.split('.');
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);

    if (isNaN(major) || isNaN(minor)) {
      return 0;
    }

    if (major > phaseMajor) {
      return 100;
    }
    if (major < phaseMajor) {
      return 0;
    }

    return Math.min(minor * 10, 100);
  }

  /**
   * Derive status from a progress value.
   * 0 = planned, 100 = complete, 1-99 = in-progress.
   */
  static deriveStatus(progress: number): VersionStatus {
    if (progress <= 0) {
      return 'planned';
    }
    if (progress >= 100) {
      return 'complete';
    }
    return 'in-progress';
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
