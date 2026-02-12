import type { IncomingMessage, ServerResponse } from 'node:http';

import type {
  FeatureFileInput,
  IFeatureRepository,
  INodeRepository,
} from '../../use-cases/index.js';
import { ExportFeatures } from '../../use-cases/index.js';
import { SeedFeaturesApi } from '../../use-cases/index.js';

import type { Route } from './routes-shared.js';
import { json, stripHtml } from './routes-shared.js';

type ScanFn = () => Promise<FeatureFileInput[]>;
type WriteFeatureFileFn = (dir: string, filename: string, content: string) => Promise<void>;
type EnsureDirFn = (dir: string) => Promise<void>;

export interface SeedExportDeps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
  scanFeatureFiles: ScanFn;
  writeFeatureFile: WriteFeatureFileFn;
  ensureDir: EnsureDirFn;
}

// ─── Route builder ──────────────────────────────────────────────────

export function buildSeedExportRoutes(deps: SeedExportDeps): Route[] {
  const seedUc = new SeedFeaturesApi({
    featureRepo: deps.featureRepo,
    nodeRepo: deps.nodeRepo,
    scanFeatureFiles: deps.scanFeatureFiles,
  });

  const exportUc = new ExportFeatures({
    featureRepo: deps.featureRepo,
    writeFeatureFile: deps.writeFeatureFile,
    ensureDir: deps.ensureDir,
  });

  return [
    {
      method: 'POST',
      pattern: /^\/api\/admin\/seed-features$/,
      handler: async (_req: IncomingMessage, res: ServerResponse) => {
        const result = await seedUc.execute();
        json(res, 200, result);
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/admin\/export-features$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const rawComponent = url.searchParams.get('component') ?? undefined;
        const component = rawComponent ? stripHtml(rawComponent) : undefined;
        const result = await exportUc.execute(component);
        json(res, 200, result);
      },
    },
  ];
}
