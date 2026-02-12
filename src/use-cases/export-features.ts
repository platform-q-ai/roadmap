import type { IFeatureRepository } from '../domain/index.js';

type WriteFeatureFileFn = (dir: string, filename: string, content: string) => Promise<void>;
type EnsureDirFn = (dir: string) => Promise<void>;

export interface ExportFeaturesResult {
  exported: number;
}

interface Deps {
  featureRepo: IFeatureRepository;
  writeFeatureFile: WriteFeatureFileFn;
  ensureDir: EnsureDirFn;
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

  constructor({ featureRepo, writeFeatureFile, ensureDir }: Deps) {
    this.featureRepo = featureRepo;
    this.writeFeatureFile = writeFeatureFile;
    this.ensureDir = ensureDir;
  }

  async execute(component?: string): Promise<ExportFeaturesResult> {
    const features = component
      ? await this.featureRepo.findByNode(component)
      : await this.featureRepo.findAll();

    const dirsCreated = new Set<string>();
    let exported = 0;

    for (const f of features) {
      const dir = `components/${f.node_id}/features`;
      if (!dirsCreated.has(dir)) {
        await this.ensureDir(dir);
        dirsCreated.add(dir);
      }
      await this.writeFeatureFile(dir, f.filename, f.content ?? '');
      exported++;
    }

    return { exported };
  }
}
