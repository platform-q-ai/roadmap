import type { IncomingMessage, ServerResponse } from 'node:http';

import { GetFeatureVersionScoped } from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import { errorMessage, errorStatus, json } from './routes-shared.js';

// ─── Helpers ────────────────────────────────────────────────────────

function wantsPlainText(req: IncomingMessage): boolean {
  const accept = req.headers.accept ?? '';
  return accept.includes('text/plain');
}

function countScenarios(content: string | null): number {
  if (!content) return 0;
  return (content.match(/^\s*Scenario(?:\s+Outline)?:/gm) ?? []).length;
}

function enrichFeature(f: Record<string, unknown>): Record<string, unknown> {
  const content = typeof f.content === 'string' ? f.content : '';
  return { ...f, scenario_count: countScenarios(content) };
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
    const features = result.features.map(f => enrichFeature(f.toJSON()));
    json(res, 200, { features, totals: result.totals });
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
    const feature = await uc.executeSingle(params.nodeId, params.version, params.filename);
    if (wantsPlainText(req)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(feature.content ?? '');
      return;
    }
    const enriched = enrichFeature(feature.toJSON());
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
