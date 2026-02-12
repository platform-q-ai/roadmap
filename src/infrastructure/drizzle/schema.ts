import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ─── Nodes ───────────────────────────────────────────────────────────

export const nodesTable = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  layer: text('layer'),
  color: text('color'),
  icon: text('icon'),
  description: text('description'),
  tags: text('tags'),
  sort_order: integer('sort_order').default(0),
  current_version: text('current_version'),
});

// ─── Edges ───────────────────────────────────────────────────────────

export const edgesTable = sqliteTable(
  'edges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_id: text('source_id')
      .notNull()
      .references(() => nodesTable.id, { onDelete: 'cascade' }),
    target_id: text('target_id')
      .notNull()
      .references(() => nodesTable.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    label: text('label'),
    metadata: text('metadata'),
  },
  table => [
    uniqueIndex('edges_source_target_type').on(table.source_id, table.target_id, table.type),
  ]
);

// ─── Node Versions ───────────────────────────────────────────────────

export const nodeVersionsTable = sqliteTable(
  'node_versions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    node_id: text('node_id')
      .notNull()
      .references(() => nodesTable.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    content: text('content'),
    progress: integer('progress').default(0),
    status: text('status').default('planned'),
    updated_at: text('updated_at'),
  },
  table => [uniqueIndex('node_versions_node_version').on(table.node_id, table.version)]
);

// ─── Features ────────────────────────────────────────────────────────

export const featuresTable = sqliteTable('features', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  node_id: text('node_id')
    .notNull()
    .references(() => nodesTable.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  filename: text('filename').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  step_count: integer('step_count').default(0),
  updated_at: text('updated_at'),
});

// ─── API Keys ─────────────────────────────────────────────────────────

export const apiKeysTable = sqliteTable(
  'api_keys',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    key_hash: text('key_hash').notNull(),
    salt: text('salt').notNull(),
    scopes: text('scopes').notNull(),
    created_at: text('created_at').notNull(),
    expires_at: text('expires_at'),
    last_used_at: text('last_used_at'),
    is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  table => [uniqueIndex('api_keys_name').on(table.name)]
);
