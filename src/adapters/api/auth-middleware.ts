import type http from 'node:http';

import type { RequestWithId } from './routes.js';

interface AuthKey {
  id: number;
  name: string;
  scopes: string[];
  is_active: boolean;
}

export interface AuthMiddlewareDeps {
  validateKey: (plaintext: string) => Promise<AuthKey | null>;
}

export interface AuthenticatedRequest extends http.IncomingMessage {
  apiKey?: AuthKey;
  requestId?: string;
}

/**
 * Determine the required scope for a request based on method + URL.
 *
 * - GET requests require "read"
 * - POST, PUT, PATCH, DELETE require "write"
 * - /api/admin/* requires "admin"
 */
function requiredScope(method: string, url: string): string {
  if (url.startsWith('/api/admin')) {
    return 'admin';
  }
  if (method === 'GET' || method === 'HEAD') {
    return 'read';
  }
  return 'write';
}

interface ErrorPayload {
  status: number;
  error: string;
  code: string;
}

function jsonError(
  res: http.ServerResponse,
  payload: ErrorPayload,
  req?: http.IncomingMessage
): void {
  const requestId = req ? (req as RequestWithId).requestId : undefined;
  res.writeHead(payload.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: payload.error, code: payload.code, request_id: requestId }));
}

/**
 * Create an auth middleware function.
 *
 * Returns `true` if the request is allowed to proceed,
 * `false` if the middleware has already sent an error response.
 *
 * The health endpoint (/api/health) is exempt from authentication.
 */
export function createAuthMiddleware(deps: AuthMiddlewareDeps) {
  return async function authMiddleware(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<boolean> {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // Health endpoint is exempt
    if (url === '/api/health') {
      return true;
    }

    // Extract key from Authorization header or X-API-Key
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];

    let plaintext: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      plaintext = authHeader.slice(7);
    } else if (typeof apiKeyHeader === 'string') {
      plaintext = apiKeyHeader;
    }

    if (!plaintext) {
      jsonError(
        res,
        { status: 401, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
        req
      );
      return false;
    }

    const key = await deps.validateKey(plaintext);
    if (!key) {
      jsonError(
        res,
        { status: 401, error: 'Invalid or expired API key', code: 'INVALID_API_KEY' },
        req
      );
      return false;
    }

    // Check scope
    const scope = requiredScope(method, url);
    if (!key.scopes.includes(scope)) {
      jsonError(
        res,
        { status: 403, error: `Insufficient scope: requires ${scope}`, code: 'INSUFFICIENT_SCOPE' },
        req
      );
      return false;
    }

    // Attach key to request for downstream handlers
    (req as AuthenticatedRequest).apiKey = key;
    return true;
  };
}
