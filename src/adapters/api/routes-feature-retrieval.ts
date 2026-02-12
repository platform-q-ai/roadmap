import type { IncomingMessage, ServerResponse } from 'node:http';

import { GetFeatureVersionScoped } from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import { errorMessage, errorStatus, json } from './routes-shared.js';

// ─── Helpers ────────────────────────────────────────────────────────

function wantsPlainText(req: IncomingMessage): boolean {
  const accept = req.headers.accept ?? '';
  return accept.includes('text/plain');
}

// ─── Handlers ───────────────────────────────────────────────────────

async function handleGetFeaturesByVersion(
  uc: GetFeatureVersionScoped,
  req: IncomingMessage,
  res: ServerResponse,
  params: { nodeId: string; version: string }
): Promise<void> {
  try {
    const result = await uc.executeList(params.nodeId, params.version);
    json(res, 200, { features: result.features, totals: result.totals });
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

async function handleGetSingleFeature(
  uc: GetFeatureVersionScoped,
  req: IncomingMessage,
  res: ServerResponse,
  params: { nodeId: string; version: string; filename: string }
): Promise<void> {
  try {
    const { feature, enriched } = await uc.executeSingle(
      params.nodeId,
      params.version,
      params.filename
    );
    if (wantsPlainText(req)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(feature.content ?? '');
      return;
    }
    json(res, 200, enriched);
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

// ─── Route builder ──────────────────────────────────────────────────

export function buildFeatureRetrievalRoutes(deps: ApiDeps): Route[] {
  const uc = new GetFeatureVersionScoped({
    featureRepo: deps.featureRepo,
    nodeRepo: deps.nodeRepo,
  });

  return [
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/versions\/([^/]+)\/features\/([^/]+)$/,
      handler: async (req, res, m) =>
        handleGetSingleFeature(uc, req, res, {
          nodeId: m[1],
          version: m[2],
          filename: m[3],
        }),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/versions\/([^/]+)\/features$/,
      handler: async (req, res, m) =>
        handleGetFeaturesByVersion(uc, req, res, {
          nodeId: m[1],
          version: m[2],
        }),
    },
  ];
}
