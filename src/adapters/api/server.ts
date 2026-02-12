import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import { extname, normalize, resolve } from 'node:path';

import type { AuthenticatedRequest } from './auth-middleware.js';
import type { RateLimiter, RateLimitResult } from './rate-limiter.js';
import type { ApiDeps, RequestWithId, Route } from './routes.js';
import { buildRoutes } from './routes.js';

export interface RequestLogEntry {
  method: string;
  path: string;
  status: number;
  duration: number;
  request_id: string;
  key_name?: string;
}

export interface AppOptions {
  staticDir?: string;
  packageVersion?: string;
  authMiddleware?: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<boolean>;
  rateLimiter?: RateLimiter;
  adminRoutes?: Route[];
  allowedOrigins?: string[];
  onLog?: (entry: RequestLogEntry) => void;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

async function serveStatic(
  staticDir: string,
  urlPath: string,
  res: http.ServerResponse
): Promise<boolean> {
  const safePath = normalize(urlPath === '/' ? '/index.html' : urlPath);

  // Prevent path traversal: resolved path must stay within staticDir
  const resolved = resolve(staticDir, safePath.slice(1));
  const canonicalDir = resolve(staticDir);
  if (!resolved.startsWith(canonicalDir + '/') && resolved !== canonicalDir) {
    return false;
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return false;
    }
  } catch {
    return false;
  }

  const mime = getMimeType(resolved);
  res.writeHead(200, { 'Content-Type': mime });
  createReadStream(resolved).pipe(res);
  return true;
}

function setCorsHeaders(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  allowedOrigins?: string[]
): void {
  const origin = req.headers['origin'];

  if (!allowedOrigins || allowedOrigins.length === 0) {
    // Development mode: allow all origins
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // If origin is not allowed, do NOT set Access-Control-Allow-Origin

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
}

function setSecurityHeaders(res: http.ServerResponse, requestId: string): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Request-Id', requestId);
}

interface RequestContext {
  method: string;
  url: string;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  requestId: string;
  startTime: number;
}

interface LogContext {
  onLog?: (entry: RequestLogEntry) => void;
  req: http.IncomingMessage;
  ctx: RequestContext;
  status: number;
}

function setRateLimitHeaders(res: http.ServerResponse, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(result.reset));
}

async function tryApiRoute(routes: Route[], ctx: RequestContext): Promise<boolean> {
  for (const route of routes) {
    if (route.method !== ctx.method) {
      continue;
    }
    const pathname = ctx.url.split('?')[0];
    const match = pathname.match(route.pattern);
    if (!match) {
      continue;
    }
    try {
      await route.handler(ctx.req, ctx.res, match);
    } catch (err) {
      if (err instanceof Error) {
        console.error(`[${ctx.requestId}] Internal error: ${err.message}`);
      }
      ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
      ctx.res.end(
        JSON.stringify({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          request_id: ctx.requestId,
        })
      );
    }
    return true;
  }
  return false;
}

function resolveRequestId(req: http.IncomingMessage): string {
  const clientId = req.headers['x-request-id'];
  if (typeof clientId === 'string' && clientId.length > 0) {
    return clientId;
  }
  return randomUUID();
}

function isWriteMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

/**
 * Create an HTTP server with all API routes wired up.
 *
 * Accepts repository dependencies (injected by the caller) and returns
 * a standard Node.js http.Server ready to listen on a port.
 *
 * When `options.staticDir` is provided, the server also serves static
 * files from that directory. API routes take priority over static files.
 *
 * When `options.authMiddleware` is provided, all API routes except
 * /api/health require a valid API key.
 */
export function createApp(deps: ApiDeps, options?: AppOptions): http.Server {
  const baseRoutes = buildRoutes(deps, {
    packageVersion: options?.packageVersion,
  });
  const adminRoutes = options?.adminRoutes ?? [];
  const routes = [...adminRoutes, ...baseRoutes];
  const staticDir = options?.staticDir;
  const authMiddleware = options?.authMiddleware;
  const rateLimiter = options?.rateLimiter;
  const allowedOrigins = options?.allowedOrigins;
  const onLog = options?.onLog;

  const server = http.createServer(async (req, res) => {
    const ctx: RequestContext = {
      method: req.method ?? 'GET',
      url: req.url ?? '/',
      req,
      res,
      requestId: resolveRequestId(req),
      startTime: Date.now(),
    };

    setCorsHeaders(req, res, allowedOrigins);
    setSecurityHeaders(res, ctx.requestId);
    (req as RequestWithId).requestId = ctx.requestId;

    if (ctx.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      emitLog({ onLog, req, ctx, status: 204 });
      return;
    }

    if (!(await handleAuth(authMiddleware, ctx))) {
      emitLog({ onLog, req, ctx, status: res.statusCode });
      return;
    }

    if (!handleRateLimit(rateLimiter, ctx)) {
      emitLog({ onLog, req, ctx, status: 429 });
      return;
    }

    if (await tryApiRoute(routes, ctx)) {
      emitLog({ onLog, req, ctx, status: res.statusCode });
      return;
    }

    if (await tryStatic(staticDir, ctx)) {
      return;
    }

    send404(res, ctx.requestId);
    emitLog({ onLog, req, ctx, status: 404 });
  });

  return server;
}

async function handleAuth(
  authMiddleware: AppOptions['authMiddleware'],
  ctx: RequestContext
): Promise<boolean> {
  if (!authMiddleware || !ctx.url.startsWith('/api/')) {
    return true;
  }
  return authMiddleware(ctx.req, ctx.res);
}

function handleRateLimit(rateLimiter: RateLimiter | undefined, ctx: RequestContext): boolean {
  if (!rateLimiter || !ctx.url.startsWith('/api/')) {
    return true;
  }
  return checkRateLimit(rateLimiter, ctx);
}

function checkRateLimit(rateLimiter: RateLimiter, ctx: RequestContext): boolean {
  const authReq = ctx.req as AuthenticatedRequest;
  const keyName = authReq.apiKey?.name ?? '__anonymous__';

  if (ctx.url === '/api/health') {
    const result = rateLimiter.check('__health__');
    setRateLimitHeaders(ctx.res, result);
    return true;
  }

  const result = isWriteMethod(ctx.method)
    ? rateLimiter.checkWrite(keyName)
    : rateLimiter.check(keyName);

  setRateLimitHeaders(ctx.res, result);

  if (!result.allowed) {
    const retryAfter = Math.max(1, result.reset - Math.floor(Date.now() / 1000));
    ctx.res.setHeader('Retry-After', String(retryAfter));
    ctx.res.writeHead(429, { 'Content-Type': 'application/json' });
    ctx.res.end(
      JSON.stringify({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        request_id: ctx.requestId,
      })
    );
    return false;
  }

  return true;
}

async function tryStatic(staticDir: string | undefined, ctx: RequestContext): Promise<boolean> {
  if (!staticDir || ctx.method !== 'GET') {
    return false;
  }
  const urlPath = ctx.url.split('?')[0];
  return serveStatic(staticDir, urlPath, ctx.res);
}

function send404(res: http.ServerResponse, requestId: string): void {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      error: 'Not found',
      code: 'NOT_FOUND',
      request_id: requestId,
    })
  );
}

function emitLog(lc: LogContext): void {
  if (!lc.onLog) {
    return;
  }
  const authReq = lc.req as AuthenticatedRequest;
  const entry: RequestLogEntry = {
    method: lc.ctx.method,
    path: lc.ctx.url,
    status: lc.status,
    duration: Date.now() - lc.ctx.startTime,
    request_id: lc.ctx.requestId,
  };
  if (authReq.apiKey?.name) {
    entry.key_name = authReq.apiKey.name;
  }
  lc.onLog(entry);
}
