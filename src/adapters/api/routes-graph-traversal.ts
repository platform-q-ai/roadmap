import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  GetComponentContext,
  GetComponentsByStatus,
  GetDependencyTree,
  GetDependents,
  GetImplementationOrder,
  GetLayerOverview,
  GetNeighbourhood,
  GetNextImplementable,
  GetShortestPath,
} from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import { errorMessage, errorStatus, json, stripHtml } from './routes-shared.js';

const DEFAULT_DEPTH = 1;
const MAX_DEPTH = 10;
const DEFAULT_HOPS = 1;
const MAX_HOPS = 5;

function parseIntParam(value: string | null, defaultVal: number, max: number): number {
  if (!value) {
    return defaultVal;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return defaultVal;
  }
  return Math.min(parsed, max);
}

// ─── Route builder ──────────────────────────────────────────────────

export function buildGraphTraversalRoutes(deps: ApiDeps): Route[] {
  return [
    // GET /api/components/:id/dependencies?depth=N
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/dependencies$/,
      handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
        const nodeId = match[1];
        try {
          const exists = await deps.nodeRepo.exists(nodeId);
          if (!exists) {
            json(res, 404, { error: `Node not found: ${nodeId}` }, req);
            return;
          }
          const url = new URL(req.url ?? '/', 'http://localhost');
          const depth = parseIntParam(url.searchParams.get('depth'), DEFAULT_DEPTH, MAX_DEPTH);
          const uc = new GetDependencyTree(deps);
          const tree = await uc.execute(nodeId, depth);
          json(res, 200, { dependencies: tree });
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
    // GET /api/components/:id/dependents
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/dependents$/,
      handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
        const nodeId = match[1];
        try {
          const exists = await deps.nodeRepo.exists(nodeId);
          if (!exists) {
            json(res, 404, { error: `Node not found: ${nodeId}` }, req);
            return;
          }
          const uc = new GetDependents(deps);
          const dependents = await uc.execute(nodeId);
          json(res, 200, dependents);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
    // GET /api/components/:id/context
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/context$/,
      handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
        const nodeId = match[1];
        try {
          const uc = new GetComponentContext(deps);
          const context = await uc.execute(nodeId);
          json(res, 200, context);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
    // GET /api/components/:id/neighbourhood?hops=N
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/neighbourhood$/,
      handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
        const nodeId = match[1];
        try {
          const exists = await deps.nodeRepo.exists(nodeId);
          if (!exists) {
            json(res, 404, { error: `Node not found: ${nodeId}` }, req);
            return;
          }
          const url = new URL(req.url ?? '/', 'http://localhost');
          const hops = parseIntParam(url.searchParams.get('hops'), DEFAULT_HOPS, MAX_HOPS);
          const uc = new GetNeighbourhood(deps);
          const result = await uc.execute(nodeId, hops);
          json(res, 200, result);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
    // GET /api/graph/implementation-order
    {
      method: 'GET',
      pattern: /^\/api\/graph\/implementation-order$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const uc = new GetImplementationOrder(deps);
          const result = await uc.execute();
          if (result.cycle) {
            json(res, 409, { error: 'Dependency cycle detected', cycle: result.cycle }, req);
            return;
          }
          json(res, 200, result.order);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
    // GET /api/graph/components-by-status?version=X
    {
      method: 'GET',
      pattern: /^\/api\/graph\/components-by-status$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const version = stripHtml(url.searchParams.get('version') ?? 'mvp');
        try {
          const uc = new GetComponentsByStatus(deps);
          const result = await uc.execute(version);
          json(res, 200, result);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
    // GET /api/graph/next-implementable?version=X
    {
      method: 'GET',
      pattern: /^\/api\/graph\/next-implementable$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const version = stripHtml(url.searchParams.get('version') ?? 'mvp');
        try {
          const uc = new GetNextImplementable(deps);
          const result = await uc.execute(version);
          json(res, 200, result);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
    // GET /api/graph/path?from=X&to=Y
    {
      method: 'GET',
      pattern: /^\/api\/graph\/path$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const fromId = url.searchParams.get('from');
        const toId = url.searchParams.get('to');
        if (!fromId || !toId) {
          json(res, 400, { error: 'Missing required query parameters: from, to' }, req);
          return;
        }
        try {
          const uc = new GetShortestPath(deps);
          const result = await uc.execute(stripHtml(fromId), stripHtml(toId));
          json(res, 200, result);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
    // GET /api/graph/layer-overview
    {
      method: 'GET',
      pattern: /^\/api\/graph\/layer-overview$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const uc = new GetLayerOverview(deps);
          const result = await uc.execute();
          json(res, 200, result);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, errorStatus(msg), { error: msg }, req);
        }
      },
    },
  ];
}
