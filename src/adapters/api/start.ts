#!/usr/bin/env tsx
// API adapter entry point: Start the REST API server.
// Usage: npx tsx src/adapters/api/start.ts
// Environment: PORT (default 3000), DB_PATH (default db/architecture.db)

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createDrizzleConnection,
  createRawConnection,
  DrizzleApiKeyRepository,
  DrizzleEdgeRepository,
  DrizzleFeatureRepository,
  DrizzleNodeRepository,
  DrizzleVersionRepository,
} from '../../infrastructure/index.js';
import { SqliteComponentPositionRepository } from '../../infrastructure/sqlite/component-position-repository.js';
import { GenerateApiKey, ValidateApiKey } from '../../use-cases/index.js';

import type { RequestLogEntry } from './index.js';
import {
  buildAdminRoutes,
  createApp,
  createAuthMiddleware,
  RateLimiter,
  seedApiKeys,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const DB_PATH = process.env.DB_PATH ?? join(ROOT, 'db', 'architecture.db');
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const WEB_DIR = join(ROOT, 'web');

const db = createDrizzleConnection(DB_PATH);

const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const packageVersion: string = packageJson.version;

// Repositories
const nodeRepo = new DrizzleNodeRepository(db);
const edgeRepo = new DrizzleEdgeRepository(db);
const versionRepo = new DrizzleVersionRepository(db);
const featureRepo = new DrizzleFeatureRepository(db);
const apiKeyRepo = new DrizzleApiKeyRepository(db);
const sqliteDb = createRawConnection(DB_PATH);
const componentPositionRepo = new SqliteComponentPositionRepository(sqliteDb);

// Use cases
const validateApiKey = new ValidateApiKey({ apiKeyRepo });
const generateApiKey = new GenerateApiKey({ apiKeyRepo });
const authMiddleware = createAuthMiddleware({
  validateKey: async (plaintext: string) => {
    const result = await validateApiKey.execute(plaintext);
    if (result.status !== 'valid') {
      return result;
    }
    return {
      status: 'valid' as const,
      key: {
        id: result.key.id,
        name: result.key.name,
        scopes: [...result.key.scopes],
        is_active: result.key.is_active,
      },
    };
  },
});

// Rate limiter
const rateLimiter = new RateLimiter();

// Admin routes
const adminRoutes = buildAdminRoutes({ apiKeyRepo });

// CORS origins
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map(s => s.trim())
  : undefined;

// Request logging
function onLog(entry: RequestLogEntry): void {
  const keyPart = entry.key_name ? ` key=${entry.key_name}` : '';
  console.warn(
    `[${entry.request_id}] ${entry.method} ${entry.path} ${entry.status} ${entry.duration}ms${keyPart}`
  );
}

await seedApiKeys({
  rawEnv: process.env.API_KEY_SEED,
  generate: generateApiKey,
  log: (msg: string) => console.warn(msg),
});

const server = createApp(
  { nodeRepo, edgeRepo, versionRepo, featureRepo, componentPositionRepo },
  {
    staticDir: WEB_DIR,
    packageVersion,
    authMiddleware,
    rateLimiter,
    adminRoutes,
    allowedOrigins,
    onLog,
  }
);

server.listen(PORT, () => {
  console.warn(`API server listening on port ${PORT}`);
  console.warn(`  Database: ${DB_PATH}`);
  console.warn(`  Static:   ${WEB_DIR}`);
  console.warn(`  Health:   http://localhost:${PORT}/api/health`);
  console.warn(`  Web view: http://localhost:${PORT}/`);
  console.warn(`  Auth:     enabled`);
});
