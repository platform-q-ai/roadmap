import type http from 'node:http';

import type { RequestWithId } from './routes.js';

interface AuthKey {
  id: number;
  name: string;
  scopes: string[];
  is_active: boolean;
}

export type ValidationResult =
  | { status: 'valid'; key: AuthKey }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'revoked' };

export interface AuthMiddlewareDeps {
  validateKey: (plaintext: string) => Promise<ValidationResult>;
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

const VALIDATION_ERRORS: Record<string, ErrorPayload> = {
  expired: { status: 401, error: 'API key expired', code: 'API_KEY_EXPIRED' },
  revoked: { status: 401, error: 'API key revoked', code: 'API_KEY_REVOKED' },
  invalid: { status: 401, error: 'Invalid API key', code: 'INVALID_API_KEY' },
};

function sendAuthError(
  res: http.ServerResponse,
  payload: ErrorPayload,
  req: http.IncomingMessage
): false {
  const requestId = (req as RequestWithId).requestId;
  res.writeHead(payload.status, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': 'Bearer',
  });
  res.end(
    JSON.stringify({
      error: payload.error,
      code: payload.code,
      request_id: requestId,
    })
  );
  return false;
}

function extractApiKey(req: http.IncomingMessage): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }
  return undefined;
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

    if (url === '/api/health' || url === '/api/architecture') {
      return true;
    }

    const plaintext = extractApiKey(req);
    if (!plaintext) {
      return sendAuthError(
        res,
        { status: 401, error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' },
        req
      );
    }

    const result = await deps.validateKey(plaintext);

    const errorPayload = VALIDATION_ERRORS[result.status];
    if (errorPayload) {
      return sendAuthError(res, errorPayload, req);
    }

    if (result.status !== 'valid') {
      return sendAuthError(res, VALIDATION_ERRORS['invalid'], req);
    }

    const scope = requiredScope(method, url);
    if (!result.key.scopes.includes(scope)) {
      return sendAuthError(
        res,
        { status: 403, error: `Insufficient scope: ${scope} required`, code: 'INSUFFICIENT_SCOPE' },
        req
      );
    }

    (req as AuthenticatedRequest).apiKey = result.key;
    return true;
  };
}
