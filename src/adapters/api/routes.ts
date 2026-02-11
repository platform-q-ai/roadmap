import type { IncomingMessage, ServerResponse } from 'node:http';

import type {
  CreateComponentInput,
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
  NodeType,
} from '../../use-cases/index.js';
import {
  CreateComponent,
  DeleteComponent,
  DeleteFeature,
  GetArchitecture,
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

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
  });
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

function parseCreateInput(body: Record<string, unknown>): CreateComponentInput | null {
  const { id, name, type, layer, description, tags } = body;
  if (!id || !name || !type || !layer) {
    return null;
  }
  const typeStr = String(type);
  if (!VALID_NODE_TYPES.includes(typeStr)) {
    return null;
  }
  return {
    id: String(id),
    name: String(name),
    type: typeStr as NodeType,
    layer: String(layer),
    description: description ? String(description) : undefined,
    tags: Array.isArray(tags) ? tags.map(String) : undefined,
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

async function handleGetComponent(deps: ApiDeps, res: ServerResponse, id: string) {
  const node = await deps.nodeRepo.findById(id);
  if (!node) {
    json(res, 404, { error: `Component not found: ${id}` });
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
  const raw = await readBody(req);
  const body = parseJsonBody(raw);
  if (!body) {
    json(res, 400, { error: 'Invalid JSON body' });
    return;
  }
  const input = parseCreateInput(body);
  if (!input) {
    json(res, 400, { error: 'Missing or invalid fields: id, name, type, layer' });
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
    json(res, errorStatus(msg), { error: msg });
  }
}

async function handleDeleteComponent(deps: ApiDeps, res: ServerResponse, id: string) {
  const uc = new DeleteComponent(deps);
  try {
    await uc.execute(id);
    res.writeHead(204);
    res.end();
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg });
  }
}

async function handleGetFeatures(deps: ApiDeps, res: ServerResponse, id: string) {
  const node = await deps.nodeRepo.findById(id);
  if (!node) {
    json(res, 404, { error: `Component not found: ${id}` });
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
  const content = await readBody(req);
  const uc = new UploadFeature({ featureRepo: deps.featureRepo, nodeRepo: deps.nodeRepo });
  try {
    const result = await uc.execute({ nodeId: params.nodeId, filename: params.filename, content });
    json(res, 200, result);
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg });
  }
}

async function handleDeleteFeature(
  deps: ApiDeps,
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
    json(res, errorStatus(msg), { error: msg });
  }
}

async function handleGetEdges(deps: ApiDeps, res: ServerResponse, id: string) {
  const node = await deps.nodeRepo.findById(id);
  if (!node) {
    json(res, 404, { error: `Component not found: ${id}` });
    return;
  }
  const inbound = await deps.edgeRepo.findByTarget(id);
  const outbound = await deps.edgeRepo.findBySource(id);
  json(res, 200, {
    inbound: inbound.map(e => e.toJSON()),
    outbound: outbound.map(e => e.toJSON()),
  });
}

async function handleGetDependencies(deps: ApiDeps, res: ServerResponse, id: string) {
  const node = await deps.nodeRepo.findById(id);
  if (!node) {
    json(res, 404, { error: `Component not found: ${id}` });
    return;
  }
  const outbound = await deps.edgeRepo.findBySource(id);
  const inbound = await deps.edgeRepo.findByTarget(id);
  const dependencies = outbound.filter(e => e.type === 'DEPENDS_ON').map(e => e.toJSON());
  const dependents = inbound.filter(e => e.type === 'DEPENDS_ON').map(e => e.toJSON());
  json(res, 200, { dependencies, dependents });
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
      handler: async (_req, res, m) => handleGetComponent(deps, res, m[1]),
    },
    {
      method: 'POST',
      pattern: /^\/api\/components$/,
      handler: async (req, res) => handleCreateComponent(deps, req, res),
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/components\/([^/]+)$/,
      handler: async (_req, res, m) => handleDeleteComponent(deps, res, m[1]),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/features$/,
      handler: async (_req, res, m) => handleGetFeatures(deps, res, m[1]),
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
      handler: async (_req, res, m) =>
        handleDeleteFeature(deps, res, { nodeId: m[1], filename: m[2] }),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/edges$/,
      handler: async (_req, res, m) => handleGetEdges(deps, res, m[1]),
    },
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/dependencies$/,
      handler: async (_req, res, m) => handleGetDependencies(deps, res, m[1]),
    },
  ];
}
