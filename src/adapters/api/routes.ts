import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Node, UpdateComponentInput } from '../../use-cases/index.js';
import {
  CreateComponent,
  DeleteComponent,
  DeleteFeature,
  GetArchitecture,
  UpdateComponent,
  UpdateVersion,
  UploadFeature,
} from '../../use-cases/index.js';

import {
  handleBulkCreateComponents,
  handleBulkCreateEdges,
  handleBulkDeleteComponents,
} from './routes-bulk.js';
import type { ApiDeps, Route } from './routes-shared.js';
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

export type { ApiDeps, Route } from './routes-shared.js';
export type { RequestWithId } from './routes-shared.js';

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

async function handleUpdateComponent(
  deps: ApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
  id: string
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
  const { input, error } = parsePatchInput(body);
  if (!input) {
    json(res, 400, { error: error ?? 'No updatable fields provided' }, req);
    return;
  }
  const uc = new UpdateComponent({
    nodeRepo: deps.nodeRepo,
    versionRepo: deps.versionRepo,
  });
  try {
    const node = await uc.execute(id, input);
    json(res, 200, node.toJSON());
  } catch (err) {
    const msg = errorMessage(err);
    json(res, errorStatus(msg), { error: msg }, req);
  }
}

interface PatchParseResult {
  input: UpdateComponentInput | null;
  error?: string;
}

const MAX_TAGS = 50;

function parsePatchInput(body: Record<string, unknown>): PatchParseResult {
  const input: UpdateComponentInput = {};
  if (body.name !== undefined) {
    const sanitised = stripHtml(String(body.name));
    if (!sanitised) {
      return { input: null, error: 'Invalid name: name must not be empty' };
    }
    input.name = sanitised;
  }
  if (body.description !== undefined) {
    input.description = stripHtml(String(body.description));
  }
  if (body.tags !== undefined && Array.isArray(body.tags)) {
    input.tags = body.tags.slice(0, MAX_TAGS).map(t => stripHtml(String(t)));
  }
  if (body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) {
    input.sort_order = Number(body.sort_order);
  }
  if (body.current_version !== undefined) {
    input.current_version = stripHtml(String(body.current_version));
  }
  if (Object.keys(input).length === 0) {
    return { input: null, error: 'No updatable fields provided' };
  }
  return { input };
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
      method: 'POST',
      pattern: /^\/api\/bulk\/components$/,
      handler: async (req, res) => handleBulkCreateComponents(deps, req, res),
    },
    {
      method: 'POST',
      pattern: /^\/api\/bulk\/edges$/,
      handler: async (req, res) => handleBulkCreateEdges(deps, req, res),
    },
    {
      method: 'POST',
      pattern: /^\/api\/bulk\/delete\/components$/,
      handler: async (req, res) => handleBulkDeleteComponents(deps, req, res),
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
      method: 'PATCH',
      pattern: /^\/api\/components\/([^/]+)$/,
      handler: async (req, res, m) => handleUpdateComponent(deps, req, res, m[1]),
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
