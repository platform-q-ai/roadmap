import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Node } from '@domain/entities/node.js';
import { SqliteNodeRepository } from '@infrastructure/sqlite/node-repository.js';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('SqliteNodeRepository', () => {
  let db: Database.Database;
  let repo: SqliteNodeRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schema = readFileSync(join(process.cwd(), 'schema.sql'), 'utf-8');
    db.exec(schema);
    repo = new SqliteNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('saves and retrieves a node by id', async () => {
    const node = new Node({ id: 'comp-1', name: 'Component 1', type: 'component' });
    await repo.save(node);

    const found = await repo.findById('comp-1');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Component 1');
    expect(found?.type).toBe('component');
  });

  it('returns null for a missing node', async () => {
    const found = await repo.findById('missing');
    expect(found).toBeNull();
  });

  it('retrieves all nodes ordered by sort_order', async () => {
    await repo.save(new Node({ id: 'b', name: 'B', type: 'component', sort_order: 2 }));
    await repo.save(new Node({ id: 'a', name: 'A', type: 'component', sort_order: 1 }));

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('a');
    expect(all[1].id).toBe('b');
  });

  it('finds nodes by type', async () => {
    await repo.save(new Node({ id: 'l', name: 'Layer', type: 'layer' }));
    await repo.save(new Node({ id: 'c1', name: 'C1', type: 'component' }));
    await repo.save(new Node({ id: 'c2', name: 'C2', type: 'component' }));

    const components = await repo.findByType('component');
    expect(components).toHaveLength(2);

    const layers = await repo.findByType('layer');
    expect(layers).toHaveLength(1);
  });

  it('finds nodes by layer', async () => {
    await repo.save(new Node({ id: 'l1', name: 'L1', type: 'layer' }));
    await repo.save(new Node({ id: 'c1', name: 'C1', type: 'component', layer: 'l1' }));
    await repo.save(new Node({ id: 'c2', name: 'C2', type: 'component', layer: 'l1' }));
    await repo.save(new Node({ id: 'c3', name: 'C3', type: 'component', layer: 'other' }));

    const inL1 = await repo.findByLayer('l1');
    expect(inL1).toHaveLength(2);
  });

  it('checks node existence', async () => {
    await repo.save(new Node({ id: 'exists', name: 'E', type: 'component' }));

    expect(await repo.exists('exists')).toBe(true);
    expect(await repo.exists('missing')).toBe(false);
  });

  it('deletes a node', async () => {
    await repo.save(new Node({ id: 'del', name: 'Del', type: 'component' }));
    await repo.delete('del');

    expect(await repo.findById('del')).toBeNull();
  });

  it('upserts on save (INSERT OR REPLACE)', async () => {
    await repo.save(new Node({ id: 'up', name: 'Original', type: 'component' }));
    await repo.save(new Node({ id: 'up', name: 'Updated', type: 'component' }));

    const found = await repo.findById('up');
    expect(found?.name).toBe('Updated');

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
  });

  it('persists tags as JSON', async () => {
    await repo.save(new Node({ id: 'tags', name: 'Tags', type: 'component', tags: ['a', 'b'] }));

    const found = await repo.findById('tags');
    expect(found?.tags).toEqual(['a', 'b']);
  });
});
