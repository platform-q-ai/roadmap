import type { IncomingMessage, ServerResponse } from 'node:http';

import { DeleteFeatureVersionScoped } from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import { errorMessage, errorStatus, json } from './routes-shared.js';

// ─── Version-scoped feature deletion handlers ───────────────────────

async function handleDeleteFeatureVersionScoped(
  uc: DeleteFeatureVersionScoped,
  req: IncomingMessage,
  res: ServerResponse,
  params: { nodeId: string; version: string; filename: string }
): Promise<void> {
  try {
    await uc.executeSingle(params.nodeId, params.version, params.filename);
    res.writeHead(204);
    res.end();
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

async function handleDeleteAllFeaturesForVersion(
  uc: DeleteFeatureVersionScoped,
  req: IncomingMessage,
  res: ServerResponse,
  params: { nodeId: string; version: string }
): Promise<void> {
  try {
    await uc.executeVersion(params.nodeId, params.version);
    res.writeHead(204);
    res.end();
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

async function handleDeleteAllFeaturesForNode(
  uc: DeleteFeatureVersionScoped,
  req: IncomingMessage,
  res: ServerResponse,
  nodeId: string
): Promise<void> {
  try {
    await uc.executeAll(nodeId);
    res.writeHead(204);
    res.end();
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

// ─── Route builder ──────────────────────────────────────────────────

export function buildFeatureDeletionRoutes(deps: ApiDeps): Route[] {
  const uc = new DeleteFeatureVersionScoped({
    featureRepo: deps.featureRepo,
    nodeRepo: deps.nodeRepo,
  });

  return [
    {
      method: 'DELETE',
      pattern: /^\/api\/components\/([^/]+)\/versions\/([^/]+)\/features\/([^/]+)$/,
      handler: async (req, res, m) =>
        handleDeleteFeatureVersionScoped(uc, req, res, {
          nodeId: m[1],
          version: m[2],
          filename: m[3],
        }),
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/components\/([^/]+)\/versions\/([^/]+)\/features$/,
      handler: async (req, res, m) =>
        handleDeleteAllFeaturesForVersion(uc, req, res, {
          nodeId: m[1],
          version: m[2],
        }),
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/components\/([^/]+)\/features$/,
      handler: async (req, res, m) => handleDeleteAllFeaturesForNode(uc, req, res, m[1]),
    },
  ];
}
