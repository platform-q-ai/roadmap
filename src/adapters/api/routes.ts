import type { IncomingMessage, ServerResponse } from 'node:http';

import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '../../use-cases/index.js';
import {
  CreateComponent,
  DeleteComponent,
  Feature,
  GetArchitecture,
  UpdateProgress,
} from '../../use-cases/index.js';

export interface ApiDeps {
  nodeRepo: INodeRepository;
  edgeRepo: IEdgeRepository;
  versionRepo: IVersionRepository;
  featureRepo: IFeatureRepository;
}

interface Route {
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

export function buildRoutes(deps: ApiDeps): Route[] {
  const { nodeRepo, edgeRepo, versionRepo, featureRepo } = deps;

  return [
    // GET /api/health
    {
      method: 'GET',
      pattern: /^\/api\/health$/,
      handler: async (_req, res) => {
        json(res, 200, { status: 'ok' });
      },
    },

    // GET /api/architecture
    {
      method: 'GET',
      pattern: /^\/api\/architecture$/,
      handler: async (_req, res) => {
        const uc = new GetArchitecture({ nodeRepo, edgeRepo, versionRepo, featureRepo });
        const data = await uc.execute();
        json(res, 200, data);
      },
    },

    // GET /api/components
    {
      method: 'GET',
      pattern: /^\/api\/components$/,
      handler: async (_req, res) => {
        const all = await nodeRepo.findAll();
        const components = all.filter(n => !n.isLayer());
        json(
          res,
          200,
          components.map(n => n.toJSON())
        );
      },
    },

    // GET /api/components/:id
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)$/,
      handler: async (_req, res, match) => {
        const id = match[1];
        const node = await nodeRepo.findById(id);
        if (!node) {
          json(res, 404, { error: `Component not found: ${id}` });
          return;
        }
        const versions = await versionRepo.findByNode(id);
        const features = await featureRepo.findByNode(id);
        json(res, 200, {
          ...node.toJSON(),
          versions: versions.map(v => v.toJSON()),
          features: features.map(f => f.toJSON()),
        });
      },
    },

    // POST /api/components
    {
      method: 'POST',
      pattern: /^\/api\/components$/,
      handler: async (req, res) => {
        const raw = await readBody(req);
        const body = parseJsonBody(raw);
        if (!body) {
          json(res, 400, { error: 'Invalid JSON body' });
          return;
        }
        const { id, name, type, layer, description, tags } = body;
        if (!id || !name || !type || !layer) {
          json(res, 400, { error: 'Missing required fields: id, name, type, layer' });
          return;
        }
        const uc = new CreateComponent({ nodeRepo, edgeRepo, versionRepo });
        try {
          await uc.execute({
            id: String(id),
            name: String(name),
            type: String(type) as Parameters<typeof uc.execute>[0]['type'],
            layer: String(layer),
            description: description ? String(description) : undefined,
            tags: Array.isArray(tags) ? tags.map(String) : undefined,
          });
          json(res, 201, { id, name, type, layer });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('already exists')) {
            json(res, 409, { error: msg });
          } else {
            json(res, 400, { error: msg });
          }
        }
      },
    },

    // DELETE /api/components/:id
    {
      method: 'DELETE',
      pattern: /^\/api\/components\/([^/]+)$/,
      handler: async (_req, res, match) => {
        const id = match[1];
        const uc = new DeleteComponent({ nodeRepo, edgeRepo, versionRepo, featureRepo });
        try {
          await uc.execute(id);
          res.writeHead(204);
          res.end();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not found') || msg.includes('Not found')) {
            json(res, 404, { error: msg });
          } else {
            json(res, 400, { error: msg });
          }
        }
      },
    },

    // PATCH /api/components/:id/versions/:version/progress
    {
      method: 'PATCH',
      pattern: /^\/api\/components\/([^/]+)\/versions\/([^/]+)\/progress$/,
      handler: async (req, res, match) => {
        const [, nodeId, version] = match;
        const raw = await readBody(req);
        const body = parseJsonBody(raw);
        if (!body) {
          json(res, 400, { error: 'Invalid JSON body' });
          return;
        }
        const progress = Number(body.progress);
        const status = String(body.status ?? '');
        if (isNaN(progress) || !status) {
          json(res, 400, { error: 'Missing required fields: progress, status' });
          return;
        }
        const uc = new UpdateProgress({ versionRepo, nodeRepo });
        try {
          await uc.execute(nodeId, version, progress, status as Parameters<typeof uc.execute>[3]);
          json(res, 200, { nodeId, version, progress, status });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not found') || msg.includes('Not found')) {
            json(res, 404, { error: msg });
          } else {
            json(res, 400, { error: msg });
          }
        }
      },
    },

    // GET /api/components/:id/features
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/features$/,
      handler: async (_req, res, match) => {
        const id = match[1];
        const node = await nodeRepo.findById(id);
        if (!node) {
          json(res, 404, { error: `Component not found: ${id}` });
          return;
        }
        const features = await featureRepo.findByNode(id);
        json(
          res,
          200,
          features.map(f => f.toJSON())
        );
      },
    },

    // PUT /api/components/:id/features/:filename
    {
      method: 'PUT',
      pattern: /^\/api\/components\/([^/]+)\/features\/([^/]+)$/,
      handler: async (req, res, match) => {
        const [, nodeId, filename] = match;
        const node = await nodeRepo.findById(nodeId);
        if (!node) {
          json(res, 404, { error: `Component not found: ${nodeId}` });
          return;
        }
        const content = await readBody(req);
        const version = Feature.versionFromFilename(filename);
        const title = Feature.titleFromContent(content, filename);
        const feature = new Feature({
          node_id: nodeId,
          version,
          filename,
          title,
          content,
        });
        await featureRepo.save(feature);
        json(res, 200, { filename, version, title, node_id: nodeId });
      },
    },

    // GET /api/components/:id/edges
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/edges$/,
      handler: async (_req, res, match) => {
        const id = match[1];
        const node = await nodeRepo.findById(id);
        if (!node) {
          json(res, 404, { error: `Component not found: ${id}` });
          return;
        }
        const inbound = await edgeRepo.findByTarget(id);
        const outbound = await edgeRepo.findBySource(id);
        json(res, 200, {
          inbound: inbound.map(e => e.toJSON()),
          outbound: outbound.map(e => e.toJSON()),
        });
      },
    },

    // GET /api/components/:id/dependencies
    {
      method: 'GET',
      pattern: /^\/api\/components\/([^/]+)\/dependencies$/,
      handler: async (_req, res, match) => {
        const id = match[1];
        const node = await nodeRepo.findById(id);
        if (!node) {
          json(res, 404, { error: `Component not found: ${id}` });
          return;
        }
        const outbound = await edgeRepo.findBySource(id);
        const inbound = await edgeRepo.findByTarget(id);
        const dependencies = outbound.filter(e => e.type === 'DEPENDS_ON').map(e => e.toJSON());
        const dependents = inbound.filter(e => e.type === 'DEPENDS_ON').map(e => e.toJSON());
        json(res, 200, { dependencies, dependents });
      },
    },
  ];
}
