import type { IncomingMessage, ServerResponse } from 'node:http';

import { BatchUploadFeatures } from '../../use-cases/index.js';

import type { ApiDeps } from './routes-shared.js';
import {
  BodyTooLargeError,
  errorMessage,
  errorStatus,
  json,
  parseJsonBody,
  readBody,
  stripHtml,
} from './routes-shared.js';

// ─── Batch feature handlers ─────────────────────────────────────────

function batchResultStatus(errors: unknown[]): number {
  return errors.length > 0 ? 207 : 201;
}

async function parseFeaturesBody(
  req: IncomingMessage,
  res: ServerResponse
): Promise<Array<Record<string, unknown>> | null> {
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
  if (!Array.isArray(body.features)) {
    json(res, 400, { error: 'Invalid body: expected { features: [...] }' }, req);
    return null;
  }
  return body.features as Array<Record<string, unknown>>;
}

export async function handleBatchUploadFeatures(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  params: { nodeId: string; version: string }
): Promise<void> {
  const items = await parseFeaturesBody(req, res);
  if (!items) {
    return;
  }

  const uc = new BatchUploadFeatures({
    featureRepo: deps.featureRepo,
    nodeRepo: deps.nodeRepo,
  });
  try {
    const entries = items.map(f => ({
      filename: typeof f.filename === 'string' ? stripHtml(f.filename) : '',
      content: typeof f.content === 'string' ? f.content : '',
    }));
    const result = await uc.execute({
      nodeId: params.nodeId,
      version: params.version,
      features: entries,
    });
    json(res, batchResultStatus(result.errors), result);
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

export async function handleCrossComponentBatchFeatures(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const items = await parseFeaturesBody(req, res);
  if (!items) {
    return;
  }

  const uc = new BatchUploadFeatures({
    featureRepo: deps.featureRepo,
    nodeRepo: deps.nodeRepo,
  });
  try {
    const entries = items.map(f => ({
      node_id: typeof f.node_id === 'string' ? stripHtml(f.node_id) : '',
      version: typeof f.version === 'string' ? stripHtml(f.version) : '',
      filename: typeof f.filename === 'string' ? stripHtml(f.filename) : '',
      content: typeof f.content === 'string' ? f.content : '',
    }));
    const result = await uc.executeCrossComponent({ features: entries });
    json(res, batchResultStatus(result.errors), result);
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}
