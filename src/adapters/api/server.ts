import { createReadStream, existsSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

import type { ApiDeps } from './routes.js';
import { buildRoutes } from './routes.js';

export interface AppOptions {
  staticDir?: string;
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

function serveStatic(staticDir: string, urlPath: string, res: http.ServerResponse): boolean {
  const safePath = normalize(urlPath === '/' ? '/index.html' : urlPath);

  // Prevent path traversal: resolved path must stay within staticDir
  const resolved = resolve(staticDir, safePath.slice(1));
  const canonicalDir = resolve(staticDir);
  if (!resolved.startsWith(canonicalDir + '/') && resolved !== canonicalDir) {
    return false;
  }

  if (!existsSync(resolved)) {
    return false;
  }

  const mime = getMimeType(resolved);
  res.writeHead(200, { 'Content-Type': mime });
  createReadStream(resolved).pipe(res);
  return true;
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
  const routes = buildRoutes(deps);
  const staticDir = options?.staticDir;

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    // CORS headers for cross-origin LLM tool access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API routes take priority
    for (const route of routes) {
      if (route.method !== method) {
        continue;
      }
      const match = url.match(route.pattern);
      if (match) {
        try {
          await route.handler(req, res, match);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Internal server error';
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
        return;
      }
    }

    // Try static file serving if configured
    if (staticDir && method === 'GET') {
      const urlPath = url.split('?')[0];
      if (serveStatic(staticDir, urlPath, res)) {
        return;
      }
    }

    // No route matched and no static file found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}
