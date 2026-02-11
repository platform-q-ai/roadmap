import type { VersionTag } from './version.js';

export interface FeatureProps {
  id?: number | null;
  node_id: string;
  version: VersionTag;
  filename: string;
  title: string;
  content?: string | null;
  updated_at?: string | null;
}

/**
 * Feature entity — a Gherkin feature file linked to a node and version.
 */
export class Feature {
  readonly id: number | null;
  readonly node_id: string;
  readonly version: VersionTag;
  readonly filename: string;
  readonly title: string;
  readonly content: string | null;
  readonly updated_at: string | null;

  constructor(props: FeatureProps) {
    this.id = props.id ?? null;
    this.node_id = props.node_id;
    this.version = props.version;
    this.filename = props.filename;
    this.title = props.title;
    this.content = props.content ?? null;
    this.updated_at = props.updated_at ?? null;
  }

  /** Derive version from a feature filename prefix. */
  static versionFromFilename(filename: string): VersionTag {
    if (filename.startsWith('v1-')) {
      return 'v1';
    }
    if (filename.startsWith('v2-')) {
      return 'v2';
    }
    return 'mvp';
  }

  /** Extract the Feature: title line from Gherkin content. */
  static titleFromContent(content: string, fallbackFilename: string): string {
    const match = content.match(/^Feature:\s*(.+)$/m);
    return match ? match[1].trim() : fallbackFilename.replace('.feature', '');
  }

  toJSON() {
    return {
      id: this.id,
      node_id: this.node_id,
      version: this.version,
      filename: this.filename,
      title: this.title,
      content: this.content,
      updated_at: this.updated_at,
    };
  }
}
