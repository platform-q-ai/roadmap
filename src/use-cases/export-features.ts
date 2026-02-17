import { ValidationError } from '../domain/errors.js';
import type { IFeatureRepository } from '../domain/index.js';

type WriteFeatureFileFn = (dir: string, filename: string, content: string) => Promise<void>;
type EnsureDirFn = (dir: string) => Promise<void>;
type BuildDirFn = (nodeId: string) => string;

const PATH_UNSAFE = /[/\\]|\.\./;
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_COMPONENT_LENGTH = 64;

export interface ExportFeaturesResult {
  exported: number;
}

interface Deps {
  featureRepo: IFeatureRepository;
  writeFeatureFile: WriteFeatureFileFn;
  ensureDir: EnsureDirFn;
  buildDir: BuildDirFn;
}

/**
 * ExportFeatures use case.
 *
 * Reads features from the repository and writes them to the filesystem
 * via injected I/O functions, keeping the use case infrastructure-free.
 *
 * When a component ID is specified, only features for that component
 * are exported. Otherwise all features are exported.
 */
export class ExportFeatures {
  private readonly featureRepo: IFeatureRepository;
  private readonly writeFeatureFile: WriteFeatureFileFn;
  private readonly ensureDir: EnsureDirFn;
  private readonly buildDir: BuildDirFn;

  constructor({ featureRepo, writeFeatureFile, ensureDir, buildDir }: Deps) {
    this.featureRepo = featureRepo;
    this.writeFeatureFile = writeFeatureFile;
    this.ensureDir = ensureDir;
    this.buildDir = buildDir;
  }

  async execute(component?: string): Promise<ExportFeaturesResult> {
    if (component !== undefined) {
      this.validateComponent(component);
    }

    const features = component
      ? await this.featureRepo.findByNode(component)
      : await this.featureRepo.findAll();

    const dirsCreated = new Set<string>();
    let exported = 0;

    for (const f of features) {
      if (PATH_UNSAFE.test(f.node_id) || PATH_UNSAFE.test(f.filename)) {
        continue;
      }
      const dir = this.buildDir(f.node_id);
      if (!dirsCreated.has(dir)) {
        await this.ensureDir(dir);
        dirsCreated.add(dir);
      }
      await this.writeFeatureFile(dir, f.filename, f.content ?? '');
      exported++;
    }

    return { exported };
  }

  private validateComponent(component: string): void {
    if (
      component.length === 0 ||
      component.length > MAX_COMPONENT_LENGTH ||
      !KEBAB_CASE_RE.test(component)
    ) {
      throw new ValidationError(
        `Invalid component: must be kebab-case, 1-${MAX_COMPONENT_LENGTH} chars`
      );
    }
  }
}
