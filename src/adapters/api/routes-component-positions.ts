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

function getComponentId(match: RegExpMatchArray): string | null {
  return match[1] || null;
}

function validateComponentIdFormat(
  componentId: string
): { valid: true } | { valid: false; error: string } {
  if (componentId.length > 64) {
    return { valid: false, error: 'Component ID must be 64 characters or less' };
  }

  const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!kebabCasePattern.test(componentId)) {
    return { valid: false, error: 'Component ID must be kebab-case' };
  }

  return { valid: true };
}

interface RouteContext {
  deps: ApiDeps;
  getComponentPosition: GetComponentPosition;
  saveComponentPosition: SaveComponentPosition;
  deleteComponentPosition: DeleteComponentPosition;
}

async function handleListPositions(
  ctx: RouteContext,
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const positions = ctx.deps.componentPositionRepo.findAll();
    json(res, 200, positions);
  } catch (e) {
    json(res, 500, { error: errorMessage(e) });
  }
}

async function handleGetPosition(
  ctx: RouteContext,
  _req: IncomingMessage,
  res: ServerResponse,
  match: RegExpMatchArray
): Promise<void> {
  const componentId = getComponentId(match);
  if (!componentId) {
    json(res, 400, { error: 'Invalid URL' });
    return;
  }

  const validation = validateComponentIdFormat(componentId);
  if (!validation.valid) {
    json(res, 400, { error: validation.error });
    return;
  }

  try {
    const position = ctx.getComponentPosition.execute({ componentId });
    if (position === null) {
      json(res, 404, { error: 'Position not found' });
      return;
    }
    json(res, 200, position);
  } catch (e) {
    json(res, errorStatus(errorMessage(e)), { error: errorMessage(e) });
  }
}

async function handleCreatePosition(
  ctx: RouteContext,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
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

  const validation = validateComponentIdFormat(componentId);
  if (!validation.valid) {
    json(res, 400, { error: validation.error });
    return;
  }

  const componentExists = await ctx.deps.nodeRepo.exists(componentId);
  if (!componentExists) {
    json(res, 404, { error: 'Component not found' });
    return;
  }

  try {
    const position = ctx.saveComponentPosition.execute({ componentId, x: coords.x, y: coords.y });
    json(res, 201, position);
  } catch (e) {
    json(res, errorStatus(errorMessage(e)), { error: errorMessage(e) });
  }
}

async function handleDeletePosition(
  ctx: RouteContext,
  _req: IncomingMessage,
  res: ServerResponse,
  match: RegExpMatchArray
): Promise<void> {
  const componentId = getComponentId(match);
  if (!componentId) {
    json(res, 400, { error: 'Invalid URL' });
    return;
  }
  try {
    const position = ctx.getComponentPosition.execute({ componentId });
    if (!position) {
      json(res, 404, { error: 'Position not found' });
      return;
    }
    ctx.deleteComponentPosition.execute({ componentId });
    res.writeHead(204).end();
  } catch (e) {
    json(res, errorStatus(errorMessage(e)), { error: errorMessage(e) });
  }
}

// ─── Route builder ──────────────────────────────────────────────────

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

  const ctx: RouteContext = {
    deps,
    getComponentPosition,
    saveComponentPosition,
    deleteComponentPosition,
  };

  return [
    {
      method: 'GET',
      pattern: /^\/api\/component-positions$/,
      handler: (req, res) => handleListPositions(ctx, req, res),
    },
    {
      method: 'GET',
      pattern: /^\/api\/component-positions\/([^/]+)$/,
      handler: (req, res, match) => handleGetPosition(ctx, req, res, match),
    },
    {
      method: 'POST',
      pattern: /^\/api\/component-positions$/,
      handler: (req, res) => handleCreatePosition(ctx, req, res),
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/component-positions\/([^/]+)$/,
      handler: (req, res, match) => handleDeletePosition(ctx, req, res, match),
    },
  ];
}
