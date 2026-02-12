import { describe, expect, it } from 'vitest';

/**
 * Unit tests for the DrizzleApiKeyRepository.
 *
 * Module doesn't exist yet (Phase 5) — dynamic import ensures RED.
 * Tests use a real in-memory SQLite database for integration-level
 * verification of the repository implementation.
 */

describe('DrizzleApiKeyRepository', () => {
  it('saves and retrieves an API key by id', async () => {
    const { createDrizzleConnection } =
      await import('../../../../src/infrastructure/drizzle/connection.js');
    const { DrizzleApiKeyRepository } =
      await import('../../../../src/infrastructure/drizzle/api-key-repository.js');

    const db = createDrizzleConnection(':memory:');
    const repo = new DrizzleApiKeyRepository(db);

    await repo.save({
      name: 'test-bot',
      key_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      salt: 'test-salt',
      scopes: ['read'],
      created_at: '2026-01-01T00:00:00Z',
      is_active: true,
    });

    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('test-bot');
    expect(all[0].key_hash).toBe(
      'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    );
  });

  it('finds a key by name', async () => {
    const { createDrizzleConnection } =
      await import('../../../../src/infrastructure/drizzle/connection.js');
    const { DrizzleApiKeyRepository } =
      await import('../../../../src/infrastructure/drizzle/api-key-repository.js');

    const db = createDrizzleConnection(':memory:');
    const repo = new DrizzleApiKeyRepository(db);

    await repo.save({
      name: 'named-bot',
      key_hash: 'hash1',
      salt: 'salt1',
      scopes: ['read', 'write'],
      created_at: '2026-01-01T00:00:00Z',
      is_active: true,
    });

    const found = await repo.findByName('named-bot');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('named-bot');
    expect(found?.scopes).toEqual(['read', 'write']);
  });

  it('returns null for non-existent name', async () => {
    const { createDrizzleConnection } =
      await import('../../../../src/infrastructure/drizzle/connection.js');
    const { DrizzleApiKeyRepository } =
      await import('../../../../src/infrastructure/drizzle/api-key-repository.js');

    const db = createDrizzleConnection(':memory:');
    const repo = new DrizzleApiKeyRepository(db);

    const found = await repo.findByName('ghost');
    expect(found).toBeNull();
  });

  it('revokes a key by setting is_active to false', async () => {
    const { createDrizzleConnection } =
      await import('../../../../src/infrastructure/drizzle/connection.js');
    const { DrizzleApiKeyRepository } =
      await import('../../../../src/infrastructure/drizzle/api-key-repository.js');

    const db = createDrizzleConnection(':memory:');
    const repo = new DrizzleApiKeyRepository(db);

    await repo.save({
      name: 'revokable',
      key_hash: 'hash2',
      salt: 'salt2',
      scopes: ['read'],
      created_at: '2026-01-01T00:00:00Z',
      is_active: true,
    });

    const all = await repo.findAll();
    const keyId = all[0].id;

    await repo.revoke(keyId);

    const revoked = await repo.findById(keyId);
    expect(revoked).not.toBeNull();
    expect(revoked?.is_active).toBe(false);
  });

  it('updates last_used_at timestamp', async () => {
    const { createDrizzleConnection } =
      await import('../../../../src/infrastructure/drizzle/connection.js');
    const { DrizzleApiKeyRepository } =
      await import('../../../../src/infrastructure/drizzle/api-key-repository.js');

    const db = createDrizzleConnection(':memory:');
    const repo = new DrizzleApiKeyRepository(db);

    await repo.save({
      name: 'trackable',
      key_hash: 'hash3',
      salt: 'salt3',
      scopes: ['read'],
      created_at: '2026-01-01T00:00:00Z',
      is_active: true,
    });

    const all = await repo.findAll();
    const keyId = all[0].id;

    expect(all[0].last_used_at).toBeNull();

    await repo.updateLastUsed(keyId);

    const updated = await repo.findById(keyId);
    expect(updated?.last_used_at).not.toBeNull();
  });

  it('stores scopes as JSON and parses them back', async () => {
    const { createDrizzleConnection } =
      await import('../../../../src/infrastructure/drizzle/connection.js');
    const { DrizzleApiKeyRepository } =
      await import('../../../../src/infrastructure/drizzle/api-key-repository.js');

    const db = createDrizzleConnection(':memory:');
    const repo = new DrizzleApiKeyRepository(db);

    await repo.save({
      name: 'scoped-bot',
      key_hash: 'hash4',
      salt: 'salt4',
      scopes: ['read', 'write', 'admin'],
      created_at: '2026-01-01T00:00:00Z',
      is_active: true,
    });

    const found = await repo.findByName('scoped-bot');
    expect(found?.scopes).toEqual(['read', 'write', 'admin']);
  });
});
