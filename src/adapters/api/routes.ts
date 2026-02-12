import type { IncomingMessage, ServerResponse } from 'node:http';

import type {
  CreateComponentInput,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
  NodeType,
  VersionStatus,
} from '../../use-cases/index.js';
import {
  CreateComponent,
  DeleteComponent,
  DeleteFeature,
  GetArchitecture,
  UpdateVersion,
  UploadFeature,
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
  return (req as IncomingMessage & { requestId?: string }).requestId;
}

function json(res: ServerResponse, status: number, data: unknown, req?: IncomingMessage): void {
  // Inject request_id into error responses (status >= 400)
  if (req && status >= 400 && typeof data === 'object' && data !== null) {
    const requestId = getRequestId(req);
    if (requestId) {
      (data as Record<string, unknown>).request_id = requestId;
    }
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
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

const VALID_NODE_TYPES: readonly string[] = [
  'layer',
  'component',
  'store',
  'external',
  'phase',
  'app',
];

interface ParseResult {
  input: CreateComponentInput | null;
  error?: string;
}

function parseCreateInput(body: Record<string, unknown>): ParseResult {
  const { id, name, type, layer, description, tags } = body;
  if (!id || !name || !type || !layer) {
    return { input: null, error: 'Missing or invalid fields: id, name, type, layer' };
  }
  const idStr = String(id);
  if (!KEBAB_CASE_RE.test(idStr)) {
    return { input: null, error: `Invalid id format: must be kebab-case (got "${idStr}")` };
  }
  const typeStr = String(type);
  if (!VALID_NODE_TYPES.includes(typeStr)) {
    return { input: null, error: `Invalid node type: ${typeStr}` };
  }
  return {
    input: {
      id: idStr,
      name: String(name),
      type: typeStr as NodeType,
      layer: String(layer),
      description: description ? String(description) : undefined,
      tags: Array.isArray(tags) ? tags.map(String) : undefined,
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

async function handleListComponents(deps: ApiDeps, _req: IncomingMessage, res: ServerResponse) {
  const all = await deps.nodeRepo.findAll();
  const components = all.filter(n => !n.isLayer());
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
    await uc.execute(input);
    json(res, 201, { id: input.id, name: input.name, type: input.type, layer: input.layer });
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
  const status = body.status !== undefined ? (String(body.status) as VersionStatus) : undefined;

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
