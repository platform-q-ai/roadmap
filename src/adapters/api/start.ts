#!/usr/bin/env tsx
// API adapter entry point: Start the REST API server.
// Usage: npx tsx src/adapters/api/start.ts
// Environment: PORT (default 3000), DB_PATH (default db/architecture.db)

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createDrizzleConnection,
  DrizzleApiKeyRepository,
  DrizzleEdgeRepository,
  DrizzleFeatureRepository,
  DrizzleNodeRepository,
  DrizzleVersionRepository,
} from '../../infrastructure/index.js';
import type { ApiKeyScope } from '../../use-cases/index.js';
import { GenerateApiKey, ValidateApiKey } from '../../use-cases/index.js';

import type { RequestLogEntry } from './index.js';
import { buildAdminRoutes, createApp, createAuthMiddleware, RateLimiter } from './index.js';

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

// Auth middleware
const validateApiKey = new ValidateApiKey({ apiKeyRepo });
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

// Seed API keys from environment on first boot.
// API_KEY_SEED is a JSON array: [{"name":"admin","scopes":["read","write","admin"]}, ...]
// For each entry, a key is generated if one with that name doesn't already exist.
// The plaintext keys are logged to stderr once — save them immediately.
async function seedApiKeys(): Promise<void> {
  const raw = process.env.API_KEY_SEED;
  if (!raw) {
    return;
  }
  const entries = JSON.parse(raw) as Array<{ name: string; scopes: ApiKeyScope[] }>;
  const generateApiKey = new GenerateApiKey({ apiKeyRepo });
  for (const entry of entries) {
    const existing = await apiKeyRepo.findByName(entry.name);
    if (existing) {
      continue;
    }
    const result = await generateApiKey.execute(entry);
    console.warn(`  Seeded key "${entry.name}": ${result.plaintext}`);
  }
}

await seedApiKeys();

const server = createApp(
  { nodeRepo, edgeRepo, versionRepo, featureRepo },
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
