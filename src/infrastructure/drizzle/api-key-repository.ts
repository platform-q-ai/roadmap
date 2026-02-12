import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { ApiKeyProps } from '../../domain/index.js';
import type { IApiKeyRepository } from '../../domain/index.js';
import { ApiKey } from '../../domain/index.js';

import { apiKeysTable } from './schema.js';

type SaveInput = Omit<ApiKeyProps, 'id'>;

function rowToApiKey(row: typeof apiKeysTable.$inferSelect): ApiKey {
  return new ApiKey({
    id: row.id,
    name: row.name,
    key_hash: row.key_hash,
    salt: row.salt,
    scopes: row.scopes,
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
    last_used_at: row.last_used_at ?? null,
    is_active: row.is_active,
  });
}

export class DrizzleApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  async save(props: SaveInput): Promise<void> {
    this.db
      .insert(apiKeysTable)
      .values({
        name: props.name,
        key_hash: props.key_hash,
        salt: props.salt,
        scopes: JSON.stringify(props.scopes),
        created_at: props.created_at,
        expires_at: props.expires_at ?? null,
        last_used_at: props.last_used_at ?? null,
        is_active: props.is_active,
      })
      .run();
  }

  async findAll(): Promise<ApiKey[]> {
    const rows = this.db.select().from(apiKeysTable).all();
    return rows.map(rowToApiKey);
  }

  async findById(id: number): Promise<ApiKey | null> {
    const rows = this.db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id)).all();
    return rows.length > 0 ? rowToApiKey(rows[0]) : null;
  }

  async findByName(name: string): Promise<ApiKey | null> {
    const rows = this.db.select().from(apiKeysTable).where(eq(apiKeysTable.name, name)).all();
    return rows.length > 0 ? rowToApiKey(rows[0]) : null;
  }

  async revoke(id: number): Promise<void> {
    this.db.update(apiKeysTable).set({ is_active: false }).where(eq(apiKeysTable.id, id)).run();
  }

  async updateLastUsed(id: number): Promise<void> {
    this.db
      .update(apiKeysTable)
      .set({ last_used_at: sql`datetime('now')` })
      .where(eq(apiKeysTable.id, id))
      .run();
  }
}
