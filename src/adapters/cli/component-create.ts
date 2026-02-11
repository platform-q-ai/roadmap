#!/usr/bin/env tsx
// CLI adapter: Create a new component in the architecture database.
// Usage: npx tsx src/adapters/cli/component-create.ts <id> <name> <type> <layer> [description] [tags]
// Example: npx tsx src/adapters/cli/component-create.ts my-service "My Service" app supervisor-layer "Manages things" "tag1,tag2"

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  createDrizzleConnection,
  DrizzleEdgeRepository,
  DrizzleNodeRepository,
  DrizzleVersionRepository,
} from '../../infrastructure/index.js';
import { CreateComponent } from '../../use-cases/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const DB_PATH = join(ROOT, 'db', 'architecture.db');

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('Usage: component-create <id> <name> <type> <layer> [description] [tags]');
  process.exit(1);
}

const [id, name, type, layer, description, tagsStr] = args;
const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined;

const db = createDrizzleConnection(DB_PATH);

const createComponent = new CreateComponent({
  nodeRepo: new DrizzleNodeRepository(db),
  edgeRepo: new DrizzleEdgeRepository(db),
  versionRepo: new DrizzleVersionRepository(db),
});

await createComponent.execute({
  id,
  name,
  type: type as Parameters<typeof createComponent.execute>[0]['type'],
  layer,
  description,
  tags,
});
console.log(`Created component "${name}" (${id}) in layer ${layer}`);
