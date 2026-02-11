import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { INodeRepository } from '../../domain/index.js';
import { Node } from '../../domain/index.js';

import { nodesTable } from './schema.js';

export class DrizzleNodeRepository implements INodeRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  async findAll(): Promise<Node[]> {
    const rows = this.db.select().from(nodesTable).orderBy(nodesTable.sort_order).all();
    return rows.map(r => new Node(r as ConstructorParameters<typeof Node>[0]));
  }

  async findById(id: string): Promise<Node | null> {
    const rows = this.db.select().from(nodesTable).where(eq(nodesTable.id, id)).all();
    return rows.length > 0 ? new Node(rows[0] as ConstructorParameters<typeof Node>[0]) : null;
  }

  async findByType(type: string): Promise<Node[]> {
    const rows = this.db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.type, type))
      .orderBy(nodesTable.sort_order)
      .all();
    return rows.map(r => new Node(r as ConstructorParameters<typeof Node>[0]));
  }

  async findByLayer(layerId: string): Promise<Node[]> {
    const rows = this.db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.layer, layerId))
      .orderBy(nodesTable.sort_order)
      .all();
    return rows.map(r => new Node(r as ConstructorParameters<typeof Node>[0]));
  }

  async exists(id: string): Promise<boolean> {
    const rows = this.db
      .select({ one: sql`1` })
      .from(nodesTable)
      .where(eq(nodesTable.id, id))
      .all();
    return rows.length > 0;
  }

  async save(node: Node): Promise<void> {
    this.db
      .insert(nodesTable)
      .values({
        id: node.id,
        name: node.name,
        type: node.type,
        layer: node.layer,
        color: node.color,
        icon: node.icon,
        description: node.description,
        tags: node.tagsJson(),
        sort_order: node.sort_order,
        current_version: node.current_version,
      })
      .onConflictDoUpdate({
        target: nodesTable.id,
        set: {
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          layer: sql`excluded.layer`,
          color: sql`excluded.color`,
          icon: sql`excluded.icon`,
          description: sql`excluded.description`,
          tags: sql`excluded.tags`,
          sort_order: sql`excluded.sort_order`,
          current_version: sql`excluded.current_version`,
        },
      })
      .run();
  }

  async delete(id: string): Promise<void> {
    this.db.delete(nodesTable).where(eq(nodesTable.id, id)).run();
  }
}
