import type { IncomingMessage, ServerResponse } from 'node:http';

import type {
  CreateComponentInput,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
  NodeType,
} from '../../use-cases/index.js';
import { VALID_NODE_TYPES } from '../../use-cases/index.js';

// ─── Interfaces ─────────────────────────────────────────────────────

export interface RequestWithId extends IncomingMessage {
  requestId?: string;
}

export interface ApiDeps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
}

export interface Route {
  method: string;
  pattern: RegExp;
  handler: (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray) => Promise<void>;
}

export interface ParseResult {
  input: CreateComponentInput | null;
  error?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_ID_LENGTH = 64;

// ─── Utility functions ──────────────────────────────────────────────

export function getRequestId(req: IncomingMessage): string | undefined {
  return (req as RequestWithId).requestId;
}

export function json(
  res: ServerResponse,
  status: number,
  data: unknown,
  req?: IncomingMessage
): void {
  let payload = data;
  // Inject request_id into error responses (status >= 400)
  if (req && status >= 400 && typeof data === 'object' && data !== null) {
    const requestId = getRequestId(req);
    if (requestId) {
      payload = { ...(data as Record<string, unknown>), request_id: requestId };
    }
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export class BodyTooLargeError extends Error {
  constructor() {
    super('Request body too large');
    this.name = 'BodyTooLargeError';
  }
}

export async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        tooLarge = true;
        // Continue reading to drain the stream, but stop accumulating
        return;
      }
      if (!tooLarge) {
        body += chunk.toString();
      }
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new BodyTooLargeError());
      } else {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

export function parseJsonBody(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function errorStatus(msg: string): number {
  if (msg.includes('already exists')) {
    return 409;
  }
  if (msg.includes('not found') || msg.includes('Not found')) {
    return 404;
  }
  return 400;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Strip HTML tags from a string to prevent XSS / injection.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// ─── Input validation ───────────────────────────────────────────────

function validateRequiredFields(
  body: Record<string, unknown>
): { idStr: string; nameStr: string; typeStr: string; layer?: string } | string {
  const { id, name, type, layer } = body;
  if (!id || !type) {
    return 'Missing or invalid fields: id, name, type';
  }
  const nameStr = name !== undefined && name !== null ? String(name) : '';
  if (!nameStr) {
    return 'Invalid name: name must not be empty';
  }
  const idStr = String(id);
  if (idStr.length > MAX_ID_LENGTH) {
    return `Invalid id: must be ${MAX_ID_LENGTH} characters or fewer (got ${idStr.length})`;
  }
  if (!KEBAB_CASE_RE.test(idStr)) {
    const safeId = stripHtml(idStr).slice(0, MAX_ID_LENGTH);
    return `Invalid id format: must be kebab-case (got "${safeId}")`;
  }
  const typeStr = stripHtml(String(type));
  if (!VALID_NODE_TYPES.includes(typeStr)) {
    return `Invalid node type: ${typeStr}`;
  }
  return {
    idStr,
    nameStr,
    typeStr,
    layer: layer ? stripHtml(String(layer)) : undefined,
  };
}

export function parseCreateInput(body: Record<string, unknown>): ParseResult {
  const validated = validateRequiredFields(body);
  if (typeof validated === 'string') {
    return { input: null, error: validated };
  }
  const { description, tags, color, icon, sort_order } = body;
  return {
    input: {
      id: validated.idStr,
      name: stripHtml(validated.nameStr),
      type: validated.typeStr as NodeType,
      layer: validated.layer,
      description: description ? stripHtml(String(description)) : undefined,
      tags: Array.isArray(tags) ? tags.map(t => stripHtml(String(t))) : undefined,
      color: color ? stripHtml(String(color)) : undefined,
      icon: icon ? stripHtml(String(icon)) : undefined,
      sort_order:
        sort_order !== undefined && Number.isFinite(Number(sort_order))
          ? Number(sort_order)
          : undefined,
    },
  };
}
