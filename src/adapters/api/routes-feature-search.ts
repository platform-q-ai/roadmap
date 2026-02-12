import type { IncomingMessage, ServerResponse } from 'node:http';

import { SearchFeatures } from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import { errorMessage, json, stripHtml } from './routes-shared.js';

const MAX_QUERY_LENGTH = 200;
const DEFAULT_SEARCH_LIMIT = 100;

// ─── Route builder ──────────────────────────────────────────────────

export function buildFeatureSearchRoutes(deps: ApiDeps): Route[] {
  const uc = new SearchFeatures({ featureRepo: deps.featureRepo });

  return [
    {
      method: 'GET',
      pattern: /^\/api\/features\/search$/,
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const q = url.searchParams.get('q');
        const rawVersion = url.searchParams.get('version') ?? undefined;
        const version = rawVersion ? stripHtml(rawVersion) : undefined;

        if (!q || !q.trim()) {
          json(res, 400, { error: 'Missing or empty query parameter: q' }, req);
          return;
        }

        if (q.length > MAX_QUERY_LENGTH) {
          json(res, 400, { error: `Query too long (max ${MAX_QUERY_LENGTH} characters)` }, req);
          return;
        }

        try {
          const results = await uc.execute(q, version, DEFAULT_SEARCH_LIMIT);
          json(res, 200, results);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, 400, { error: msg }, req);
        }
      },
    },
  ];
}
