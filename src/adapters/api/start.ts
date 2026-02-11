#!/usr/bin/env tsx
// API adapter entry point: Start the REST API server.
// Usage: npx tsx src/adapters/api/start.ts
// Environment: PORT (default 3000), DB_PATH (default db/architecture.db)

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createDrizzleConnection,
  DrizzleEdgeRepository,
  DrizzleFeatureRepository,
  DrizzleNodeRepository,
  DrizzleVersionRepository,
} from '../../infrastructure/index.js';

import { createApp } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const DB_PATH = process.env.DB_PATH ?? join(ROOT, 'db', 'architecture.db');
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const db = createDrizzleConnection(DB_PATH);

const server = createApp({
  nodeRepo: new DrizzleNodeRepository(db),
  edgeRepo: new DrizzleEdgeRepository(db),
  versionRepo: new DrizzleVersionRepository(db),
  featureRepo: new DrizzleFeatureRepository(db),
});

server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`  Database: ${DB_PATH}`);
  console.log(`  Health:   http://localhost:${PORT}/api/health`);
});
