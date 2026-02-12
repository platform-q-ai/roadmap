import type { IncomingMessage, ServerResponse } from 'node:http';

import { SearchFeatures } from '../../use-cases/index.js';

import type { ApiDeps, Route } from './routes-shared.js';
import { errorMessage, json } from './routes-shared.js';

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
        const version = url.searchParams.get('version') ?? undefined;

        if (!q || !q.trim()) {
          json(res, 400, { error: 'Missing or empty query parameter: q' }, req);
          return;
        }

        try {
          const results = await uc.execute(q, version);
          json(res, 200, results);
        } catch (err) {
          const msg = errorMessage(err);
          json(res, 400, { error: msg }, req);
        }
      },
    },
  ];
}
