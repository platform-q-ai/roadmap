import type { IncomingMessage, ServerResponse } from 'node:http';

import type {
  FeatureFileInput,
  IFeatureRepository,
  INodeRepository,
} from '../../use-cases/index.js';
import { ExportFeatures, SeedFeaturesApi, ValidationError } from '../../use-cases/index.js';

import type { RequestWithId, Route } from './routes-shared.js';
import { json, stripHtml } from './routes-shared.js';

type ScanFn = () => Promise<FeatureFileInput[]>;
type WriteFeatureFileFn = (dir: string, filename: string, content: string) => Promise<void>;
type EnsureDirFn = (dir: string) => Promise<void>;
type BuildDirFn = (nodeId: string) => string;

export interface SeedExportDeps {
  featureRepo: IFeatureRepository;
  nodeRepo: INodeRepository;
  scanFeatureFiles: ScanFn;
  writeFeatureFile: WriteFeatureFileFn;
  ensureDir: EnsureDirFn;
  buildDir: BuildDirFn;
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
    buildDir: deps.buildDir,
  });

  return [
    {
      method: 'POST',
      pattern: /^\/api\/admin\/seed-features$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const result = await seedUc.execute();
          json(res, 200, result);
        } catch {
          const rid = (req as RequestWithId).requestId ?? '';
          json(res, 500, { error: 'Seed failed', code: 'INTERNAL_ERROR', request_id: rid });
        }
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/admin\/export-features$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const rawComponent = url.searchParams.get('component') ?? undefined;
          const component = rawComponent ? stripHtml(rawComponent) : undefined;
          const result = await exportUc.execute(component);
          json(res, 200, result);
        } catch (err) {
          const rid = (req as RequestWithId).requestId ?? '';
          if (err instanceof ValidationError) {
            json(res, 400, { error: err.message, code: 'VALIDATION_ERROR', request_id: rid });
            return;
          }
          json(res, 500, { error: 'Export failed', code: 'INTERNAL_ERROR', request_id: rid });
        }
      },
    },
  ];
}
