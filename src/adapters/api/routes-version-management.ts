import type { IncomingMessage, ServerResponse } from 'node:http';

import { DeleteAllVersions, GetVersion, ListVersions } from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import { errorMessage, errorStatus, json } from './routes-shared.js';

// ─── Route builders ─────────────────────────────────────────────────

function listVersionsRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/components\/([^/]+)\/versions$/,
    handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
      const nodeId = match[1];
      try {
        const uc = new ListVersions(deps);
        const versions = await uc.execute(nodeId);
        json(res, 200, versions);
      } catch (err) {
        const msg = errorMessage(err);
        json(res, errorStatus(msg), { error: msg }, req);
      }
    },
  };
}

function getVersionRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/components\/([^/]+)\/versions\/([^/]+)$/,
    handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
      const nodeId = match[1];
      const versionTag = match[2];
      try {
        const uc = new GetVersion(deps);
        const result = await uc.execute(nodeId, versionTag);
        json(res, 200, result);
      } catch (err) {
        const msg = errorMessage(err);
        json(res, errorStatus(msg), { error: msg }, req);
      }
    },
  };
}

function deleteAllVersionsRoute(deps: ApiDeps): Route {
  return {
    method: 'DELETE',
    pattern: /^\/api\/components\/([^/]+)\/versions$/,
    handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
      const nodeId = match[1];
      try {
        const uc = new DeleteAllVersions(deps);
        await uc.execute(nodeId);
        res.writeHead(204);
        res.end();
      } catch (err) {
        const msg = errorMessage(err);
        json(res, errorStatus(msg), { error: msg }, req);
      }
    },
  };
}

// ─── Public builder ─────────────────────────────────────────────────

export function buildVersionRoutes(deps: ApiDeps): Route[] {
  return [listVersionsRoute(deps), getVersionRoute(deps), deleteAllVersionsRoute(deps)];
}
