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
  updated_at: text('updated_at'),
});
