import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Edge } from '@domain/entities/edge.js';
import { Node } from '@domain/entities/node.js';
import { SqliteEdgeRepository } from '@infrastructure/sqlite/edge-repository.js';
import { SqliteNodeRepository } from '@infrastructure/sqlite/node-repository.js';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('SqliteEdgeRepository', () => {
  let db: Database.Database;
  let edgeRepo: SqliteEdgeRepository;
  let nodeRepo: SqliteNodeRepository;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schema = readFileSync(join(process.cwd(), 'schema.sql'), 'utf-8');
    db.exec(schema);
    edgeRepo = new SqliteEdgeRepository(db);
    nodeRepo = new SqliteNodeRepository(db);

    // Seed nodes for foreign keys
    await nodeRepo.save(new Node({ id: 'layer-1', name: 'L1', type: 'layer' }));
    await nodeRepo.save(new Node({ id: 'comp-a', name: 'A', type: 'component' }));
    await nodeRepo.save(new Node({ id: 'comp-b', name: 'B', type: 'component' }));
  });

  afterEach(() => {
    db.close();
  });

  it('saves and retrieves an edge', async () => {
    await edgeRepo.save(new Edge({ source_id: 'comp-a', target_id: 'comp-b', type: 'CONTROLS' }));

    const all = await edgeRepo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].source_id).toBe('comp-a');
    expect(all[0].target_id).toBe('comp-b');
    expect(all[0].type).toBe('CONTROLS');
  });

  it('finds edges by source', async () => {
    await edgeRepo.save(new Edge({ source_id: 'comp-a', target_id: 'comp-b', type: 'CONTROLS' }));
    await edgeRepo.save(new Edge({ source_id: 'layer-1', target_id: 'comp-a', type: 'CONTAINS' }));

    const edges = await edgeRepo.findBySource('comp-a');
    expect(edges).toHaveLength(1);
    expect(edges[0].target_id).toBe('comp-b');
  });

  it('finds edges by target', async () => {
    await edgeRepo.save(new Edge({ source_id: 'comp-a', target_id: 'comp-b', type: 'DEPENDS_ON' }));

    const edges = await edgeRepo.findByTarget('comp-b');
    expect(edges).toHaveLength(1);
    expect(edges[0].source_id).toBe('comp-a');
  });

  it('finds edges by type', async () => {
    await edgeRepo.save(new Edge({ source_id: 'layer-1', target_id: 'comp-a', type: 'CONTAINS' }));
    await edgeRepo.save(new Edge({ source_id: 'comp-a', target_id: 'comp-b', type: 'CONTROLS' }));

    const contains = await edgeRepo.findByType('CONTAINS');
    expect(contains).toHaveLength(1);
    expect(contains[0].type).toBe('CONTAINS');
  });

  it('finds relationships excluding CONTAINS', async () => {
    await edgeRepo.save(new Edge({ source_id: 'layer-1', target_id: 'comp-a', type: 'CONTAINS' }));
    await edgeRepo.save(new Edge({ source_id: 'comp-a', target_id: 'comp-b', type: 'DEPENDS_ON' }));

    const rels = await edgeRepo.findRelationships();
    expect(rels).toHaveLength(1);
    expect(rels[0].type).toBe('DEPENDS_ON');
  });

  it('deletes an edge by id', async () => {
    await edgeRepo.save(new Edge({ source_id: 'comp-a', target_id: 'comp-b', type: 'CONTROLS' }));
    const all = await edgeRepo.findAll();
    expect(all).toHaveLength(1);

    await edgeRepo.delete(all[0].id!);

    const afterDelete = await edgeRepo.findAll();
    expect(afterDelete).toHaveLength(0);
  });
});
