import { describe, expect, it, vi } from 'vitest';

// The SeedDatabase use case does not exist yet — this will fail (RED)
// import { SeedDatabase } from '../../../src/use-cases/index.js';

describe('SeedDatabase use case', () => {
  describe('structure', () => {
    it('should export SeedDatabase from use-cases barrel', async () => {
      const mod = await import('../../../src/use-cases/index.js');
      expect(mod).toHaveProperty('SeedDatabase');
    });

    it('should be a class with an execute method', async () => {
      const mod = await import('../../../src/use-cases/index.js');
      const SeedDatabase = (mod as Record<string, unknown>)['SeedDatabase'] as new (
        deps: unknown
      ) => { execute: () => Promise<unknown> };
      expect(typeof SeedDatabase).toBe('function');
      const instance = new SeedDatabase({ runSql: vi.fn(), readSeedSql: vi.fn() });
      expect(typeof instance.execute).toBe('function');
    });
  });

  describe('behaviour', () => {
    it('should call readSeedSql to get the SQL content', async () => {
      const mod = await import('../../../src/use-cases/index.js');
      const SeedDatabase = (mod as Record<string, unknown>)['SeedDatabase'] as new (
        deps: Record<string, unknown>
      ) => { execute: () => Promise<unknown> };
      const readSeedSql = vi.fn().mockResolvedValue('INSERT INTO nodes ...');
      const runSql = vi.fn();
      const uc = new SeedDatabase({ readSeedSql, runSql });
      await uc.execute();
      expect(readSeedSql).toHaveBeenCalledOnce();
    });

    it('should call runSql with the seed SQL content', async () => {
      const mod = await import('../../../src/use-cases/index.js');
      const SeedDatabase = (mod as Record<string, unknown>)['SeedDatabase'] as new (
        deps: Record<string, unknown>
      ) => { execute: () => Promise<unknown> };
      const seedContent = 'INSERT INTO nodes (id, name) VALUES ("a", "A");';
      const readSeedSql = vi.fn().mockResolvedValue(seedContent);
      const runSql = vi.fn();
      const uc = new SeedDatabase({ readSeedSql, runSql });
      await uc.execute();
      expect(runSql).toHaveBeenCalledWith(seedContent);
    });

    it('should return a result with seeded count', async () => {
      const mod = await import('../../../src/use-cases/index.js');
      const SeedDatabase = (mod as Record<string, unknown>)['SeedDatabase'] as new (
        deps: Record<string, unknown>
      ) => { execute: () => Promise<{ seeded: number }> };
      const readSeedSql = vi.fn().mockResolvedValue('INSERT INTO nodes ...');
      const runSql = vi.fn();
      const uc = new SeedDatabase({ readSeedSql, runSql });
      const result = await uc.execute();
      expect(result).toHaveProperty('seeded');
      expect(typeof result.seeded).toBe('number');
    });

    it('should propagate errors from runSql', async () => {
      const mod = await import('../../../src/use-cases/index.js');
      const SeedDatabase = (mod as Record<string, unknown>)['SeedDatabase'] as new (
        deps: Record<string, unknown>
      ) => { execute: () => Promise<unknown> };
      const readSeedSql = vi.fn().mockResolvedValue('BAD SQL');
      const runSql = vi.fn().mockRejectedValue(new Error('SQL error'));
      const uc = new SeedDatabase({ readSeedSql, runSql });
      await expect(uc.execute()).rejects.toThrow('SQL error');
    });
  });
});
