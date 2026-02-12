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

function parseUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost');
}

// ─── Component-scoped handlers ──────────────────────────────────────

function dependenciesRoute(deps: ApiDeps): Route {
  return {
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
        const depth = parseIntParam(
          parseUrl(req).searchParams.get('depth'),
          DEFAULT_DEPTH,
          MAX_DEPTH
        );
        const tree = await new GetDependencyTree(deps).execute(nodeId, depth);
        json(res, 200, { dependencies: tree });
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

function dependentsRoute(deps: ApiDeps): Route {
  return {
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
        const dependents = await new GetDependents(deps).execute(nodeId);
        json(res, 200, dependents);
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

function contextRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/components\/([^/]+)\/context$/,
    handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
      const nodeId = match[1];
      try {
        const context = await new GetComponentContext(deps).execute(nodeId);
        json(res, 200, context);
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

function neighbourhoodRoute(deps: ApiDeps): Route {
  return {
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
        const hops = parseIntParam(parseUrl(req).searchParams.get('hops'), DEFAULT_HOPS, MAX_HOPS);
        const result = await new GetNeighbourhood(deps).execute(nodeId, hops);
        json(res, 200, result);
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

// ─── Graph-scoped handlers ──────────────────────────────────────────

function implementationOrderRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/graph\/implementation-order$/,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const result = await new GetImplementationOrder(deps).execute();
        if (result.cycle) {
          json(res, 409, { error: 'Dependency cycle detected', cycle: result.cycle }, req);
          return;
        }
        json(res, 200, result.order);
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

function componentsByStatusRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/graph\/components-by-status$/,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const version = stripHtml(parseUrl(req).searchParams.get('version') ?? 'mvp');
      try {
        const result = await new GetComponentsByStatus(deps).execute(version);
        json(res, 200, result);
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

function nextImplementableRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/graph\/next-implementable$/,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const version = stripHtml(parseUrl(req).searchParams.get('version') ?? 'mvp');
      try {
        const result = await new GetNextImplementable(deps).execute(version);
        json(res, 200, result);
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

function shortestPathRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/graph\/path$/,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const url = parseUrl(req);
      const fromId = url.searchParams.get('from');
      const toId = url.searchParams.get('to');
      if (!fromId || !toId) {
        json(res, 400, { error: 'Missing required query parameters: from, to' }, req);
        return;
      }
      try {
        const result = await new GetShortestPath(deps).execute(stripHtml(fromId), stripHtml(toId));
        json(res, 200, result);
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

function layerOverviewRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/graph\/layer-overview$/,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const result = await new GetLayerOverview(deps).execute();
        json(res, 200, result);
      } catch (err) {
        json(res, errorStatus(errorMessage(err)), { error: errorMessage(err) }, req);
      }
    },
  };
}

// ─── Route builder ──────────────────────────────────────────────────

export function buildGraphTraversalRoutes(deps: ApiDeps): Route[] {
  return [
    dependenciesRoute(deps),
    dependentsRoute(deps),
    contextRoute(deps),
    neighbourhoodRoute(deps),
    implementationOrderRoute(deps),
    componentsByStatusRoute(deps),
    nextImplementableRoute(deps),
    shortestPathRoute(deps),
    layerOverviewRoute(deps),
  ];
}
