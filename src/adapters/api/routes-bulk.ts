import type { IncomingMessage, ServerResponse } from 'node:http';

import { CreateComponent, DeleteComponent, Edge } from '../../use-cases/index.js';

import type { ApiDeps } from './routes-shared.js';
import {
  BodyTooLargeError,
  errorMessage,
  errorStatus,
  json,
  parseCreateInput,
  parseJsonBody,
  readBody,
  stripHtml,
} from './routes-shared.js';

// ─── Bulk route handlers ────────────────────────────────────────────

const BULK_MAX_ITEMS = 100;

interface BulkError {
  id?: string;
  source_id?: string;
  target_id?: string;
  status: number;
  error: string;
}

/**
 * Read + parse JSON body, returning null (with error sent) on failure.
 * Shared by bulk handlers to reduce body-parsing boilerplate.
 */
async function readJsonBody(
  req: IncomingMessage,
  res: ServerResponse
): Promise<Record<string, unknown> | null> {
  let raw: string;
  try {
    raw = await readBody(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      json(res, 413, { error: 'Request body too large' }, req);
      return null;
    }
    throw err;
  }
  const body = parseJsonBody(raw);
  if (!body) {
    json(res, 400, { error: 'Invalid JSON body' }, req);
    return null;
  }
  return body;
}

function validateBulkArray(
  body: Record<string, unknown>,
  field: string,
  req: IncomingMessage,
  res: ServerResponse
): unknown[] | null {
  if (!Array.isArray(body[field])) {
    json(res, 400, { error: `Invalid body: expected { ${field}: [...] }` }, req);
    return null;
  }
  const items = body[field] as unknown[];
  if (items.length > BULK_MAX_ITEMS) {
    json(res, 400, { error: `Batch size exceeds maximum 100 items` }, req);
    return null;
  }
  return items;
}

function bulkCreateStatus(created: number, errorCount: number): number {
  if (errorCount > 0 && created > 0) {
    return 207;
  }
  return errorCount > 0 ? 400 : 201;
}

export async function handleBulkCreateComponents(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const items = validateBulkArray(body, 'components', req, res);
  if (!items) {
    return;
  }

  const uc = new CreateComponent({
    nodeRepo: deps.nodeRepo,
    edgeRepo: deps.edgeRepo,
    versionRepo: deps.versionRepo,
  });

  let created = 0;
  const errors: BulkError[] = [];

  for (const item of items as Array<Record<string, unknown>>) {
    const { input, error } = parseCreateInput(item);
    if (!input) {
      const itemId = typeof item.id === 'string' ? item.id : 'unknown';
      errors.push({ id: itemId, status: 400, error: error ?? 'Invalid input' });
      continue;
    }
    try {
      await uc.execute(input);
      created++;
    } catch (err) {
      const msg = errorMessage(err);
      errors.push({ id: input.id, status: errorStatus(msg), error: msg });
    }
  }

  json(res, bulkCreateStatus(created, errors.length), { created, errors }, req);
}

interface ParsedEdgeInput {
  sourceId: string;
  targetId: string;
  edgeType: string;
  label: string | null;
}

function parseEdgeItem(item: Record<string, unknown>): ParsedEdgeInput | string {
  const sourceId = typeof item.source_id === 'string' ? stripHtml(item.source_id) : '';
  const targetId = typeof item.target_id === 'string' ? stripHtml(item.target_id) : '';
  const edgeType = typeof item.type === 'string' ? stripHtml(item.type) : '';
  const label = typeof item.label === 'string' ? stripHtml(item.label) : null;

  if (!sourceId || !targetId || !edgeType) {
    return 'Missing required fields: source_id, target_id, type';
  }
  if (!Edge.TYPES.includes(edgeType as Edge['type'])) {
    return `Invalid edge type: ${edgeType}`;
  }
  return { sourceId, targetId, edgeType, label };
}

export async function handleBulkCreateEdges(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const items = validateBulkArray(body, 'edges', req, res);
  if (!items) {
    return;
  }

  let created = 0;
  const errors: BulkError[] = [];

  for (const item of items as Array<Record<string, unknown>>) {
    const parsed = parseEdgeItem(item);
    if (typeof parsed === 'string') {
      errors.push({
        source_id: String(item.source_id ?? ''),
        target_id: String(item.target_id ?? ''),
        status: 400,
        error: parsed,
      });
      continue;
    }
    const srcExists = await deps.nodeRepo.exists(parsed.sourceId);
    const tgtExists = await deps.nodeRepo.exists(parsed.targetId);
    if (!srcExists || !tgtExists) {
      errors.push({
        source_id: parsed.sourceId,
        target_id: parsed.targetId,
        status: 404,
        error: 'Referenced node not found',
      });
      continue;
    }
    try {
      const edge = new Edge({
        source_id: parsed.sourceId,
        target_id: parsed.targetId,
        type: parsed.edgeType as Edge['type'],
        label: parsed.label,
      });
      await deps.edgeRepo.save(edge);
      created++;
    } catch (err) {
      errors.push({
        source_id: parsed.sourceId,
        target_id: parsed.targetId,
        status: 400,
        error: errorMessage(err),
      });
    }
  }

  json(res, bulkCreateStatus(created, errors.length), { created, errors }, req);
}

export async function handleBulkDeleteComponents(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const items = validateBulkArray(body, 'ids', req, res);
  if (!items) {
    return;
  }

  const uc = new DeleteComponent(deps);
  let deleted = 0;
  const errors: BulkError[] = [];
  for (const id of items as string[]) {
    try {
      await uc.execute(String(id));
      deleted++;
    } catch (err) {
      const msg = errorMessage(err);
      if (!msg.includes('not found') && !msg.includes('Not found')) {
        errors.push({ id: String(id), status: errorStatus(msg), error: msg });
      }
    }
  }

  json(res, 200, { deleted, errors }, req);
}
