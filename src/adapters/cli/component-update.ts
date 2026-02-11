#!/usr/bin/env tsx
// CLI adapter: Update progress for a component version.
// Usage: npx tsx src/adapters/cli/component-update.ts <nodeId> <version> <progress> <status>
// Example: npx tsx src/adapters/cli/component-update.ts supervisor mvp 50 in-progress

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createDrizzleConnection,
  DrizzleNodeRepository,
  DrizzleVersionRepository,
} from '../../infrastructure/drizzle/index.js';
import { UpdateProgress } from '../../use-cases/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const DB_PATH = join(ROOT, 'db', 'architecture.db');

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('Usage: component-update <nodeId> <version> <progress> <status>');
  process.exit(1);
}

const [nodeId, version, progressStr, status] = args;
const progress = parseInt(progressStr, 10);

if (isNaN(progress)) {
  console.error(`Invalid progress value: ${progressStr}`);
  process.exit(1);
}

const db = createDrizzleConnection(DB_PATH);

const updateProgress = new UpdateProgress({
  nodeRepo: new DrizzleNodeRepository(db),
  versionRepo: new DrizzleVersionRepository(db),
});

await updateProgress.execute(
  nodeId,
  version as Parameters<typeof updateProgress.execute>[1],
  progress,
  status as Parameters<typeof updateProgress.execute>[3]
);
console.log(`Updated ${nodeId}/${version}: progress=${progress}%, status=${status}`);
