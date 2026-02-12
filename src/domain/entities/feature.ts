const SCENARIO_RE = /^\s*Scenario(?:\s+Outline)?:/gm;

export interface FeatureProps {
  id?: number | null;
  node_id: string;
  version: string;
  filename: string;
  title: string;
  content?: string | null;
  step_count?: number | null;
  updated_at?: string | null;
}

/**
 * Feature entity — a Gherkin feature file linked to a node and version.
 */
export class Feature {
  readonly id: number | null;
  readonly node_id: string;
  readonly version: string;
  readonly filename: string;
  readonly title: string;
  readonly content: string | null;
  readonly step_count: number;
  readonly updated_at: string | null;

  constructor(props: FeatureProps) {
    this.id = props.id ?? null;
    this.node_id = props.node_id;
    this.version = props.version;
    this.filename = props.filename;
    this.title = props.title;
    this.content = props.content ?? null;
    this.step_count = props.step_count ?? 0;
    this.updated_at = props.updated_at ?? null;
  }

  /** Derive version from a feature filename prefix (e.g. v1-, v2-, v3-, v10-). */
  static versionFromFilename(filename: string): string {
    const match = filename.match(/^(v\d+)-/);
    if (match) {
      return match[1];
    }
    return 'mvp';
  }

  /** Extract the Feature: title line from Gherkin content. */
  static titleFromContent(content: string, fallbackFilename: string): string {
    const match = content.match(/^Feature:\s*(.+)$/m);
    return match ? match[1].trim() : fallbackFilename.replace('.feature', '');
  }

  /** Count Given/When/Then/And/But steps in Gherkin content. */
  static countSteps(content: string): number {
    const stepPattern = /^\s*(Given|When|Then|And|But)\s+/gm;
    let count = 0;
    while (stepPattern.exec(content)) {
      count++;
    }
    return count;
  }

  /** Count Scenario/Scenario Outline lines in Gherkin content. */
  static countScenarios(content: string): number {
    SCENARIO_RE.lastIndex = 0;
    let count = 0;
    while (SCENARIO_RE.exec(content)) {
      count++;
    }
    return count;
  }

  /**
   * Count Given/When/Then steps individually.
   *
   * And/But inherit the preceding primary keyword's category.
   * If And/But appears before any primary keyword, it defaults to "given".
   */
  static countByKeyword(content: string): { given: number; when: number; then: number } {
    const stepRe = /^\s*(Given|When|Then|And|But)\s+/gm;
    const counts = { given: 0, when: 0, then: 0 };
    let lastPrimary: 'given' | 'when' | 'then' = 'given';
    let m: RegExpExecArray | null = stepRe.exec(content);
    while (m) {
      const kw = m[1];
      if (kw === 'Given') {
        lastPrimary = 'given';
      } else if (kw === 'When') {
        lastPrimary = 'when';
      } else if (kw === 'Then') {
        lastPrimary = 'then';
      }
      counts[lastPrimary]++;
      m = stepRe.exec(content);
    }
    return counts;
  }

  /** Check whether content contains a valid Feature: line. */
  static hasValidGherkin(content: string): boolean {
    return /^Feature:\s*\S/m.test(content);
  }

  toJSON() {
    return {
      id: this.id,
      node_id: this.node_id,
      version: this.version,
      filename: this.filename,
      title: this.title,
      content: this.content,
      step_count: this.step_count,
      updated_at: this.updated_at,
    };
  }
}
