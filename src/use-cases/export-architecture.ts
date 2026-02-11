import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../domain/index.js';

import type { ArchitectureData } from './get-architecture.js';
import { GetArchitecture } from './get-architecture.js';

type WriteJsonFn = (path: string, data: ArchitectureData) => Promise<void>;

interface Deps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
  writeJson: WriteJsonFn;
}

/**
 * ExportArchitecture use case.
 *
 * Gets the full architecture and writes it to a JSON file.
 * The file writing is injected so this use case stays infrastructure-free.
 */
export class ExportArchitecture {
  private readonly getArchitecture: GetArchitecture;
  private readonly writeJson: WriteJsonFn;

  constructor({ nodeRepo, edgeRepo, versionRepo, featureRepo, writeJson }: Deps) {
    this.getArchitecture = new GetArchitecture({ nodeRepo, edgeRepo, versionRepo, featureRepo });
    this.writeJson = writeJson;
  }

  async execute(outputPath: string): Promise<{ stats: ArchitectureData['stats'] }> {
    const data = await this.getArchitecture.execute();
    await this.writeJson(outputPath, data);
    return { stats: data.stats };
  }
}
