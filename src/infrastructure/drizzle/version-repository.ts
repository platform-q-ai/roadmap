import { and, eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { IVersionRepository, VersionTag } from '../../domain/index.js';
import { Version } from '../../domain/index.js';

import { nodeVersionsTable } from './schema.js';

export class DrizzleVersionRepository implements IVersionRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  async findAll(): Promise<Version[]> {
    const rows = this.db
      .select()
      .from(nodeVersionsTable)
      .orderBy(nodeVersionsTable.node_id, nodeVersionsTable.version)
      .all();
    return rows.map(r => new Version(r as ConstructorParameters<typeof Version>[0]));
  }

  async findByNode(nodeId: string): Promise<Version[]> {
    const rows = this.db
      .select()
      .from(nodeVersionsTable)
      .where(eq(nodeVersionsTable.node_id, nodeId))
      .orderBy(nodeVersionsTable.version)
      .all();
    return rows.map(r => new Version(r as ConstructorParameters<typeof Version>[0]));
  }

  async findByNodeAndVersion(nodeId: string, version: VersionTag): Promise<Version | null> {
    const rows = this.db
      .select()
      .from(nodeVersionsTable)
      .where(and(eq(nodeVersionsTable.node_id, nodeId), eq(nodeVersionsTable.version, version)))
      .all();
    return rows.length > 0
      ? new Version(rows[0] as ConstructorParameters<typeof Version>[0])
      : null;
  }

  async save(version: Version): Promise<void> {
    // Upsert updates content, progress, and status on conflict. This is correct
    // for use-case callers (CreateComponent, explicit saves).
    this.db
      .insert(nodeVersionsTable)
      .values({
        node_id: version.node_id,
        version: version.version,
        content: version.content,
        progress: version.progress,
        status: version.status,
        updated_at: sql`datetime('now')`,
      })
      .onConflictDoUpdate({
        target: [nodeVersionsTable.node_id, nodeVersionsTable.version],
        set: {
          content: sql`excluded.content`,
          progress: sql`excluded.progress`,
          status: sql`excluded.status`,
          updated_at: sql`datetime('now')`,
        },
      })
      .run();
  }

  async deleteByNode(nodeId: string): Promise<void> {
    this.db.delete(nodeVersionsTable).where(eq(nodeVersionsTable.node_id, nodeId)).run();
  }
}
