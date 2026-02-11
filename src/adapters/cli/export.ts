#!/usr/bin/env tsx
// CLI adapter: Export architecture.db -> web/data.json
// Usage: npx tsx src/adapters/cli/export.ts

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createConnection,
  SqliteEdgeRepository,
  SqliteFeatureRepository,
  SqliteNodeRepository,
  SqliteVersionRepository,
} from '../../infrastructure/sqlite/index.js';
import type { ArchitectureData } from '../../use-cases/index.js';
import { ExportArchitecture } from '../../use-cases/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const DB_PATH = join(ROOT, 'db', 'architecture.db');
const OUT_PATH = join(ROOT, 'web', 'data.json');

const db = createConnection(DB_PATH);

const writeJson = async (path: string, data: ArchitectureData): Promise<void> => {
  writeFileSync(path, JSON.stringify(data, null, 2));
};

const exportArchitecture = new ExportArchitecture({
  nodeRepo: new SqliteNodeRepository(db),
  edgeRepo: new SqliteEdgeRepository(db),
  versionRepo: new SqliteVersionRepository(db),
  featureRepo: new SqliteFeatureRepository(db),
  writeJson,
});

try {
  const { stats } = await exportArchitecture.execute(OUT_PATH);
  console.log(`Exported to ${OUT_PATH}`);
  console.log(
    `  ${stats.total_nodes} nodes, ${stats.total_edges} edges, ${stats.total_versions} versions, ${stats.total_features} features`
  );
} finally {
  db.close();
}
