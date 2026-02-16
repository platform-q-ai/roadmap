import { createRawConnection } from '@infrastructure/drizzle/index.js';
import { SqliteComponentPositionRepository } from '@infrastructure/sqlite/component-position-repository.js';
import { describe, expect, it } from 'vitest';

// Helper to create table for in-memory test databases
function createTable(db: ReturnType<typeof createRawConnection>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS component_positions (
      component_id TEXT PRIMARY KEY,
      x REAL NOT NULL,
      y REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

describe('SqliteComponentPositionRepository', () => {
  it('should save and retrieve a position', () => {
    const db = createRawConnection(':memory:');
    createTable(db);
    const repo = new SqliteComponentPositionRepository(db);

    const position = repo.save({ componentId: 'app1', x: 100, y: 200 });

    expect(position.componentId).toBe('app1');
    expect(position.x).toBe(100);
    expect(position.y).toBe(200);

    const retrieved = repo.findByComponentId('app1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.x).toBe(100);
    expect(retrieved?.y).toBe(200);
  });

  it('should update existing position', () => {
    const db = createRawConnection(':memory:');
    createTable(db);
    const repo = new SqliteComponentPositionRepository(db);

    repo.save({ componentId: 'app1', x: 100, y: 200 });
    const updated = repo.save({ componentId: 'app1', x: 300, y: 400 });

    expect(updated.x).toBe(300);
    expect(updated.y).toBe(400);

    const retrieved = repo.findByComponentId('app1');
    expect(retrieved?.x).toBe(300);
    expect(retrieved?.y).toBe(400);
  });

  it('should return null for non-existing position', () => {
    const db = createRawConnection(':memory:');
    createTable(db);
    const repo = new SqliteComponentPositionRepository(db);

    const position = repo.findByComponentId('nonexistent');
    expect(position).toBeNull();
  });

  it('should delete a position', () => {
    const db = createRawConnection(':memory:');
    createTable(db);
    const repo = new SqliteComponentPositionRepository(db);

    repo.save({ componentId: 'app1', x: 100, y: 200 });
    repo.delete('app1');

    const retrieved = repo.findByComponentId('app1');
    expect(retrieved).toBeNull();
  });

  it('should find all positions', () => {
    const db = createRawConnection(':memory:');
    createTable(db);
    const repo = new SqliteComponentPositionRepository(db);

    repo.save({ componentId: 'app1', x: 100, y: 200 });
    repo.save({ componentId: 'app2', x: 300, y: 400 });

    const positions = repo.findAll();
    expect(positions).toHaveLength(2);
    expect(positions.map(p => p.componentId).sort()).toEqual(['app1', 'app2']);
  });

  it('should return empty array when no positions exist', () => {
    const db = createRawConnection(':memory:');
    createTable(db);
    const repo = new SqliteComponentPositionRepository(db);

    const positions = repo.findAll();
    expect(positions).toEqual([]);
  });

  it('should handle special characters in componentId', () => {
    const db = createRawConnection(':memory:');
    createTable(db);
    const repo = new SqliteComponentPositionRepository(db);

    const id = 'test-component_123';
    repo.save({ componentId: id, x: 100, y: 200 });

    const retrieved = repo.findByComponentId(id);
    expect(retrieved?.componentId).toBe(id);
  });

  it('should persist across repository instances', () => {
    const db = createRawConnection(':memory:');
    createTable(db);
    const repo1 = new SqliteComponentPositionRepository(db);

    repo1.save({ componentId: 'app1', x: 100, y: 200 });

    // Create new repo instance with same DB
    const repo2 = new SqliteComponentPositionRepository(db);
    const retrieved = repo2.findByComponentId('app1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.x).toBe(100);
  });
});
