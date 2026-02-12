import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RequestWithId extends IncomingMessage {
  requestId?: string;
}

import type {
  CreateComponentInput,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
  Node,
  NodeType,
} from '../../use-cases/index.js';
import {
  CreateComponent,
  DeleteComponent,
  DeleteFeature,
  GetArchitecture,
  UpdateVersion,
  UploadFeature,
  VALID_NODE_TYPES,
} from '../../use-cases/index.js';

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

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function getRequestId(req: IncomingMessage): string | undefined {
  return (req as RequestWithId).requestId;
}

function json(res: ServerResponse, status: number, data: unknown, req?: IncomingMessage): void {
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

async function readBody(req: IncomingMessage): Promise<string> {
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

class BodyTooLargeError extends Error {
  constructor() {
    super('Request body too large');
    this.name = 'BodyTooLargeError';
  }
}

function parseJsonBody(raw: string): Record<string, unknown> | null {
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

function errorStatus(msg: string): number {
  if (msg.includes('already exists')) {
    return 409;
  }
  if (msg.includes('not found') || msg.includes('Not found')) {
    return 404;
  }
  return 400;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Strip HTML tags from a string to prevent XSS / injection.
 */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

interface ParseResult {
  input: CreateComponentInput | null;
  error?: string;
}

const MAX_ID_LENGTH = 64;

function validateRequiredFields(
  body: Record<string, unknown>
): { idStr: string; nameStr: string; typeStr: string; layer: string } | string {
  const { id, name, type, layer } = body;
  if (!id || !type || !layer) {
    return 'Missing or invalid fields: id, name, type, layer';
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
  return { idStr, nameStr, typeStr, layer: stripHtml(String(layer)) };
}

function parseCreateInput(body: Record<string, unknown>): ParseResult {
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

// ─── Route handlers ─────────────────────────────────────────────────

function handleHealth(_req: IncomingMessage, res: ServerResponse) {
  json(res, 200, { status: 'ok' });
}

async function handleGetArchitecture(
  deps: ApiDeps,
  _req: IncomingMessage,
  res: ServerResponse,
  packageVersion?: string
) {
  const uc = new GetArchitecture(deps);
  const data = await uc.execute({ packageVersion });
  json(res, 200, data);
}

function parseQueryParams(req: IncomingMessage): URLSearchParams {
  const fullUrl = new URL(req.url ?? '/', 'http://localhost');
  return fullUrl.searchParams;
}

async function handleListComponents(deps: ApiDeps, req: IncomingMessage, res: ServerResponse) {
  const params = parseQueryParams(req);
  const typeFilter = params.get('type');
  const layerFilter = params.get('layer');
  const tagFilter = params.get('tag');
  const searchFilter = params.get('search');

  let nodes: Node[];
  if (typeFilter) {
    nodes = await deps.nodeRepo.findByType(typeFilter);
  } else if (layerFilter) {
    nodes = await deps.nodeRepo.findByLayer(layerFilter);
  } else {
    nodes = await deps.nodeRepo.findAll();
  }

  const lower = searchFilter ? searchFilter.toLowerCase() : '';
  const components = nodes.filter(n => {
    if (n.isLayer()) {
      return false;
    }
    if (typeFilter && layerFilter && n.layer !== layerFilter) {
      return false;
    }
    if (tagFilter && !n.tags.includes(tagFilter)) {
      return false;
    }
    if (searchFilter && !n.name.toLowerCase().includes(lower)) {
      return false;
    }
    return true;
  });

  json(
    res,
    200,
    components.map(n => n.toJSON())
  );
}

async function handleGetComponent(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  id: string
) {
  const node = await deps.nodeRepo.findById(id);
  if (!node) {
    json(res, 404, { error: `Component not found: ${id}` }, req);
    return;
  }
  const versions = await deps.versionRepo.findByNode(id);
  const features = await deps.featureRepo.findByNode(id);
  json(res, 200, {
    ...node.toJSON(),
    versions: versions.map(v => v.toJSON()),
    features: features.map(f => f.toJSON()),
  });
}

async function handleCreateComponent(deps: ApiDeps, req: IncomingMessage, res: ServerResponse) {
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
  const { input, error } = parseCreateInput(body);
  if (!input) {
    json(res, 400, { error: error ?? 'Missing or invalid fields: id, name, type, layer' }, req);
    return;
  }
  const uc = new CreateComponent({
    nodeRepo: deps.nodeRepo,
    edgeRepo: deps.edgeRepo,
    versionRepo: deps.versionRepo,
  });
  try {
    const node = await uc.execute(input);
    json(res, 201, node.toJSON());
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

async function handleDeleteComponent(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  id: string
) {
  const uc = new DeleteComponent(deps);
  try {
    await uc.execute(id);
    res.writeHead(204);
    res.end();
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

async function handleGetFeatures(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  id: string
) {
  const node = await deps.nodeRepo.findById(id);
  if (!node) {
    json(res, 404, { error: `Component not found: ${id}` }, req);
    return;
  }
  const features = await deps.featureRepo.findByNode(id);
  json(
    res,
    200,
    features.map(f => f.toJSON())
  );
}

async function handleUploadFeature(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  params: { nodeId: string; filename: string }
) {
  let content: string;
  try {
    content = await readBody(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      json(res, 413, { error: 'Request body too large' }, req);
      return;
    }
    throw err;
  }
  const uc = new UploadFeature({ featureRepo: deps.featureRepo, nodeRepo: deps.nodeRepo });
  try {
    const result = await uc.execute({ nodeId: params.nodeId, filename: params.filename, content });
    json(res, 200, result);
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

async function handleDeleteFeature(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  params: { nodeId: string; filename: string }
) {
  const uc = new DeleteFeature({ featureRepo: deps.featureRepo, nodeRepo: deps.nodeRepo });
  try {
    await uc.execute(params.nodeId, params.filename);
    res.writeHead(204);
    res.end();
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

async function handleGetEdges(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  id: string
) {
  const node = await deps.nodeRepo.findById(id);
  if (!node) {
    json(res, 404, { error: `Component not found: ${id}` }, req);
    return;
  }
  const inbound = await deps.edgeRepo.findByTarget(id);
  const outbound = await deps.edgeRepo.findBySource(id);
  json(res, 200, {
    inbound: inbound.map(e => e.toJSON()),
    outbound: outbound.map(e => e.toJSON()),
  });
}

async function handleGetDependencies(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  id: string
) {
  const node = await deps.nodeRepo.findById(id);
  if (!node) {
    json(res, 404, { error: `Component not found: ${id}` }, req);
    return;
  }
  const outbound = await deps.edgeRepo.findBySource(id);
  const inbound = await deps.edgeRepo.findByTarget(id);
  const dependencies = outbound.filter(e => e.type === 'DEPENDS_ON').map(e => e.toJSON());
  const dependents = inbound.filter(e => e.type === 'DEPENDS_ON').map(e => e.toJSON());
  json(res, 200, { dependencies, dependents });
}

async function handleUpdateVersion(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  params: { nodeId: string; version: string }
) {
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
  const content = body.content !== undefined ? String(body.content) : undefined;
  const progress = body.progress !== undefined ? Number(body.progress) : undefined;
  const status = body.status !== undefined ? String(body.status) : undefined;

  if (!content) {
    json(res, 400, { error: 'content is required' }, req);
    return;
  }

  const uc = new UpdateVersion({ nodeRepo: deps.nodeRepo, versionRepo: deps.versionRepo });
  try {
    const result = await uc.execute({
      nodeId: params.nodeId,
      version: params.version,
      content,
      progress,
      status,
    });
    json(res, 200, result);
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

// ─── Route table ────────────────────────────────────────────────────

interface RouteOptions {
  packageVersion?: string;
}

export function buildRoutes(deps: ApiDeps, options?: RouteOptions): Route[] {
  return [
    {
      method: 'GET',
      pattern: /^\/api\/health$/,
      handler: async (req, res) => handleHealth(req, res),
    },
    {
      method: 'GET',
      pattern: /^\/api\/architecture$/,
      handler: async (req, res) => handleGetArchitecture(deps, req, res, options?.packageVersion),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components$/,
      handler: async (req, res) => handleListComponents(deps, req, res),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)$/,
      handler: async (req, res, m) => handleGetComponent(deps, req, res, m[1]),
    },
    {
      method: 'POST',
      pattern: /^\/api\/components$/,
      handler: async (req, res) => handleCreateComponent(deps, req, res),
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/components\/([^/]+)$/,
      handler: async (req, res, m) => handleDeleteComponent(deps, req, res, m[1]),
    },
    {
      method: 'PUT',
      pattern: /^\/api\/components\/([^/]+)\/versions\/([^/]+)$/,
      handler: async (req, res, m) =>
        handleUpdateVersion(deps, req, res, { nodeId: m[1], version: m[2] }),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/features$/,
      handler: async (req, res, m) => handleGetFeatures(deps, req, res, m[1]),
    },
    {
      method: 'PUT',
      pattern: /^\/api\/components\/([^/]+)\/features\/([^/]+)$/,
      handler: async (req, res, m) =>
        handleUploadFeature(deps, req, res, { nodeId: m[1], filename: m[2] }),
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/components\/([^/]+)\/features\/([^/]+)$/,
      handler: async (req, res, m) =>
        handleDeleteFeature(deps, req, res, { nodeId: m[1], filename: m[2] }),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/edges$/,
      handler: async (req, res, m) => handleGetEdges(deps, req, res, m[1]),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/dependencies$/,
      handler: async (req, res, m) => handleGetDependencies(deps, req, res, m[1]),
    },
  ];
}
