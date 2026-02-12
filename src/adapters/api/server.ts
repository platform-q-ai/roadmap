import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import { extname, normalize, resolve } from 'node:path';

import type { ApiDeps, RequestWithId, Route } from './routes.js';
import { buildRoutes } from './routes.js';

export interface AppOptions {
  staticDir?: string;
  packageVersion?: string;
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

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function setSecurityHeaders(res: http.ServerResponse, requestId: string): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Request-Id', requestId);
}

interface RequestContext {
  method: string;
  url: string;
  req: http.IncomingMessage;
  res: http.ServerResponse;
}

async function tryApiRoute(routes: Route[], ctx: RequestContext): Promise<boolean> {
  for (const route of routes) {
    if (route.method !== ctx.method) {
      continue;
    }
    const match = ctx.url.match(route.pattern);
    if (!match) {
      continue;
    }
    try {
      await route.handler(ctx.req, ctx.res, match);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      const reqId = (ctx.req as RequestWithId).requestId;
      ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: message, request_id: reqId }));
    }
    return true;
  }
  return false;
}

/**
 * Create an HTTP server with all API routes wired up.
 *
 * Accepts repository dependencies (injected by the caller) and returns
 * a standard Node.js http.Server ready to listen on a port.
 *
 * When `options.staticDir` is provided, the server also serves static
 * files from that directory. API routes take priority over static files.
 */
export function createApp(deps: ApiDeps, options?: AppOptions): http.Server {
  const routes = buildRoutes(deps, { packageVersion: options?.packageVersion });
  const staticDir = options?.staticDir;

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';
    const requestId = randomUUID();

    setCorsHeaders(res);
    setSecurityHeaders(res, requestId);

    // Store requestId on request for route handlers to include in error responses
    (req as RequestWithId).requestId = requestId;

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (await tryApiRoute(routes, { method, url, req, res })) {
      return;
    }

    if (staticDir && method === 'GET') {
      const urlPath = url.split('?')[0];
      if (await serveStatic(staticDir, urlPath, res)) {
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', request_id: requestId }));
  });

  return server;
}
