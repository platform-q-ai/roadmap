#!/usr/bin/env tsx
// CLI adapter: Scan components/<id>/features/<file>.feature into the database.
// Usage: npx tsx src/adapters/cli/seed-features.ts

import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createDrizzleConnection,
  DrizzleFeatureRepository,
  DrizzleNodeRepository,
} from '../../infrastructure/index.js';
import type { FeatureFileInput } from '../../use-cases/index.js';
import { SeedFeatures } from '../../use-cases/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const DB_PATH = join(ROOT, 'db', 'architecture.db');
const COMPONENTS_DIR = join(ROOT, 'components');

function scanFeatureFiles(): FeatureFileInput[] {
  const featureFiles: FeatureFileInput[] = [];

  if (!existsSync(COMPONENTS_DIR)) {
    return featureFiles;
  }

  const dirs = readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of dirs) {
    const featuresDir = join(COMPONENTS_DIR, dir, 'features');
    if (!existsSync(featuresDir)) {
      continue;
    }

    const files = readdirSync(featuresDir).filter(f => f.endsWith('.feature'));
    for (const file of files) {
      const content = readFileSync(join(featuresDir, file), 'utf-8');
      featureFiles.push({ nodeId: dir, filename: file, content });
    }
  }

  return featureFiles;
}

const db = createDrizzleConnection(DB_PATH);

const seedFeatures = new SeedFeatures({
  featureRepo: new DrizzleFeatureRepository(db),
  nodeRepo: new DrizzleNodeRepository(db),
});

const featureFiles = scanFeatureFiles();
const { seeded, skipped } = await seedFeatures.execute(featureFiles);
console.log(`Seeded ${seeded} feature files into database`);
if (skipped > 0) {
  console.log(`  Skipped ${skipped} (node_id not in nodes table)`);
}
