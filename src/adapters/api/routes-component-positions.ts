import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  DeleteComponentPosition,
  GetComponentPosition,
  SaveComponentPosition,
} from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import { errorMessage, errorStatus, json, parseJsonBody, readBody } from './routes-shared.js';

interface PositionBody {
  x?: number;
  y?: number;
  componentId?: string;
}

function parsePositionBody(body: unknown): { x: number; y: number } | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const b = body as PositionBody;
  if (typeof b.x !== 'number' || Number.isNaN(b.x)) {
    return null;
  }
  if (typeof b.y !== 'number' || Number.isNaN(b.y)) {
    return null;
  }
  return { x: b.x, y: b.y };
}

// ─── Route handlers ─────────────────────────────────────────────────

export function buildComponentPositionRoutes(deps: ApiDeps): Route[] {
  const getComponentPosition = new GetComponentPosition({
    positionRepo: deps.componentPositionRepo,
  });
  const saveComponentPosition = new SaveComponentPosition({
    positionRepo: deps.componentPositionRepo,
  });
  const deleteComponentPosition = new DeleteComponentPosition({
    positionRepo: deps.componentPositionRepo,
  });

  // GET /api/component-positions
  async function listPositions(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const positions = deps.componentPositionRepo.findAll();
      json(res, 200, positions);
    } catch (e) {
      json(res, 500, { error: errorMessage(e) });
    }
  }

  // GET /api/component-positions/:id
  async function getPosition(
    req: IncomingMessage,
    res: ServerResponse,
    match: RegExpMatchArray
  ): Promise<void> {
    const componentId = match[1];

    if (!componentId) {
      json(res, 400, { error: 'Invalid URL' });
      return;
    }

    try {
      const position = getComponentPosition.execute({ componentId });
      if (position === null) {
        json(res, 404, { error: 'Position not found' });
        return;
      }
      json(res, 200, position);
    } catch (e) {
      json(res, errorStatus(errorMessage(e)), { error: errorMessage(e) });
    }
  }

  // POST /api/component-positions
  async function createPosition(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const raw = await readBody(req);
    const body = parseJsonBody(raw);
    const coords = parsePositionBody(body);

    if (!coords) {
      json(res, 400, { error: 'Invalid request body. Expected { x: number, y: number }' });
      return;
    }

    const componentId = (body as PositionBody).componentId;
    if (!componentId) {
      json(res, 400, { error: 'componentId is required' });
      return;
    }

    try {
      const position = saveComponentPosition.execute({
        componentId,
        x: coords.x,
        y: coords.y,
      });
      json(res, 201, position);
    } catch (e) {
      json(res, errorStatus(errorMessage(e)), { error: errorMessage(e) });
    }
  }

  // DELETE /api/component-positions/:id
  async function deletePosition(
    _req: IncomingMessage,
    res: ServerResponse,
    match: RegExpMatchArray
  ): Promise<void> {
    const componentId = match[1];

    if (!componentId) {
      json(res, 400, { error: 'Invalid URL' });
      return;
    }

    try {
      deleteComponentPosition.execute({ componentId });
      res.writeHead(204).end();
    } catch (e) {
      json(res, errorStatus(errorMessage(e)), { error: errorMessage(e) });
    }
  }

  return [
    { method: 'GET', pattern: /^\/api\/component-positions$/, handler: listPositions },
    {
      method: 'GET',
      pattern: /^\/api\/component-positions\/([^\/]+)$/,
      handler: getPosition,
    },
    { method: 'POST', pattern: /^\/api\/component-positions$/, handler: createPosition },
    {
      method: 'DELETE',
      pattern: /^\/api\/component-positions\/([^\/]+)$/,
      handler: deletePosition,
    },
  ];
}
