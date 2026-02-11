#!/usr/bin/env tsx
// CLI adapter: Delete a component from the architecture database.
// Usage: npx tsx src/adapters/cli/component-delete.ts <id>
// Example: npx tsx src/adapters/cli/component-delete.ts my-service

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createConnection,
  SqliteEdgeRepository,
  SqliteFeatureRepository,
  SqliteNodeRepository,
  SqliteVersionRepository,
} from '../../infrastructure/sqlite/index.js';
import { DeleteComponent } from '../../use-cases/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const DB_PATH = join(ROOT, 'db', 'architecture.db');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: component-delete <id>');
  process.exit(1);
}

const [id] = args;

const db = createConnection(DB_PATH);

const deleteComponent = new DeleteComponent({
  nodeRepo: new SqliteNodeRepository(db),
  edgeRepo: new SqliteEdgeRepository(db),
  versionRepo: new SqliteVersionRepository(db),
  featureRepo: new SqliteFeatureRepository(db),
});

try {
  await deleteComponent.execute(id);
  console.log(`Deleted component "${id}" and all related data`);
} finally {
  db.close();
}
