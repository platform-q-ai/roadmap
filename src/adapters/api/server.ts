import http from 'node:http';

import type { ApiDeps } from './routes.js';
import { buildRoutes } from './routes.js';

/**
 * Create an HTTP server with all API routes wired up.
 *
 * Accepts repository dependencies (injected by the caller) and returns
 * a standard Node.js http.Server ready to listen on a port.
 */
export function createApp(deps: ApiDeps): http.Server {
  const routes = buildRoutes(deps);

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

    // No route matched
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}
