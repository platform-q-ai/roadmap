import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ApiKeyScope, IApiKeyRepository } from '../../use-cases/index.js';
import { GenerateApiKey, ListApiKeys, RevokeApiKey } from '../../use-cases/index.js';

import type { RequestWithId, Route } from './routes.js';

interface AdminDeps {
  apiKeyRepo: IApiKeyRepository;
}

function getRequestId(req: IncomingMessage): string | undefined {
  return (req as RequestWithId).requestId;
}

function json(res: ServerResponse, status: number, data: unknown, req?: IncomingMessage): void {
  let payload = data;
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
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const VALID_SCOPES: readonly string[] = ['read', 'write', 'admin'];

/**
 * Build admin routes for API key management.
 *
 * All routes under /api/admin/keys require the "admin" scope.
 * Authentication and authorization are handled by the auth middleware.
 */
export function buildAdminRoutes(deps: AdminDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: /^\/api\/admin\/keys$/,
      handler: async (_req, res) => {
        const uc = new ListApiKeys({ apiKeyRepo: deps.apiKeyRepo });
        const keys = await uc.execute();
        json(res, 200, keys);
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/admin\/keys$/,
      handler: async (req, res) => {
        const raw = await readBody(req);
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          json(res, 400, { error: 'Invalid JSON body' }, req);
          return;
        }

        const name = body.name;
        const scopes = body.scopes;
        const expiresAt = body.expires_at;

        if (!name || typeof name !== 'string') {
          json(res, 400, { error: 'name is required' }, req);
          return;
        }
        if (!Array.isArray(scopes) || !scopes.every(s => VALID_SCOPES.includes(String(s)))) {
          json(
            res,
            400,
            { error: 'scopes must be an array of valid scopes (read, write, admin)' },
            req
          );
          return;
        }

        const uc = new GenerateApiKey({ apiKeyRepo: deps.apiKeyRepo });
        try {
          const result = await uc.execute({
            name: String(name),
            scopes: scopes.map(String) as ApiKeyScope[],
            expiresAt: expiresAt ? String(expiresAt) : undefined,
          });
          json(res, 201, { key: result.plaintext, ...result.record });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const status = msg.includes('already exists') ? 409 : 400;
          json(res, status, { error: msg }, req);
        }
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/admin\/keys\/([^/]+)$/,
      handler: async (req, res, match) => {
        const identifier = match[1];
        const uc = new RevokeApiKey({ apiKeyRepo: deps.apiKeyRepo });
        try {
          // Try numeric ID first, then name lookup
          if (/^\d+$/.test(identifier)) {
            await uc.execute(parseInt(identifier, 10));
          } else {
            const key = await deps.apiKeyRepo.findByName(identifier);
            if (!key) {
              json(res, 404, { error: `API key not found: ${identifier}` }, req);
              return;
            }
            await uc.execute(key.id);
          }
          json(res, 200, { status: 'revoked' }, req);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const status = msg.includes('not found') ? 404 : 400;
          json(res, status, { error: msg }, req);
        }
      },
    },
  ];
}
