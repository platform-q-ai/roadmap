import type { IncomingMessage, ServerResponse } from 'node:http';

import type { CreateLayerInput } from '../../use-cases/index.js';
import { CreateLayer, GetLayer, ListLayers } from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import {
  BodyTooLargeError,
  errorMessage,
  errorStatus,
  json,
  parseJsonBody,
  readBody,
  stripHtml,
} from './routes-shared.js';

// ─── Input parsing ──────────────────────────────────────────────────

function parseCreateLayerBody(body: Record<string, unknown>): {
  input: CreateLayerInput | null;
  error?: string;
} {
  const { id, name } = body;
  if (!id) {
    return { input: null, error: 'Missing required field: id' };
  }
  const idStr = stripHtml(String(id));
  const nameStr = name !== undefined && name !== null ? stripHtml(String(name)) : '';
  if (!nameStr) {
    return { input: null, error: 'Invalid name: name must not be empty' };
  }

  const input: CreateLayerInput = { id: idStr, name: nameStr };
  if (body.color) {
    input.color = stripHtml(String(body.color));
  }
  if (body.icon) {
    input.icon = stripHtml(String(body.icon));
  }
  if (body.description) {
    input.description = stripHtml(String(body.description));
  }
  if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) {
    input.sort_order = Number(body.sort_order);
  }
  return { input };
}

// ─── Route builders ─────────────────────────────────────────────────

function listLayersRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/layers$/,
    handler: async (_req: IncomingMessage, res: ServerResponse) => {
      const uc = new ListLayers({ nodeRepo: deps.nodeRepo });
      const layers = await uc.execute();
      json(
        res,
        200,
        layers.map(l => l.toJSON())
      );
    },
  };
}

function getLayerRoute(deps: ApiDeps): Route {
  return {
    method: 'GET',
    pattern: /^\/api\/layers\/([^/]+)$/,
    handler: async (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => {
      const layerId = match[1];
      try {
        const uc = new GetLayer({ nodeRepo: deps.nodeRepo });
        const result = await uc.execute(layerId);
        json(res, 200, {
          ...result.layer.toJSON(),
          children: result.children.map(c => c.toJSON()),
        });
      } catch (err) {
        const msg = errorMessage(err);
        json(res, errorStatus(msg), { error: msg }, req);
      }
    },
  };
}

function createLayerRoute(deps: ApiDeps): Route {
  return {
    method: 'POST',
    pattern: /^\/api\/layers$/,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      let raw: string;
      try {
        raw = await readBody(req);
      } catch (err) {
        if (err instanceof BodyTooLargeError) {
          json(res, 413, { error: 'Request body too large' }, req);
          return;
        }
        throw err;
      }
      const body = parseJsonBody(raw);
      if (!body) {
        json(res, 400, { error: 'Invalid JSON body' }, req);
        return;
      }
      const { input, error } = parseCreateLayerBody(body);
      if (!input) {
        json(res, 400, { error: error ?? 'Invalid input' }, req);
        return;
      }
      try {
        const uc = new CreateLayer({ nodeRepo: deps.nodeRepo });
        const layer = await uc.execute(input);
        json(res, 201, layer.toJSON());
      } catch (err) {
        const msg = errorMessage(err);
        json(res, errorStatus(msg), { error: msg }, req);
      }
    },
  };
}

// ─── Public builder ─────────────────────────────────────────────────

export function buildLayerRoutes(deps: ApiDeps): Route[] {
  return [listLayersRoute(deps), getLayerRoute(deps), createLayerRoute(deps)];
}
