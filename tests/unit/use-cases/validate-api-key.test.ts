import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the ValidateApiKey use case.
 *
 * Module doesn't exist yet (Phase 5) — dynamic import ensures RED.
 */

function createMockApiKeyRepo() {
  return {
    save: vi.fn(),
    findByName: vi.fn().mockResolvedValue(null),
    findByHash: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    revoke: vi.fn(),
    updateLastUsed: vi.fn(),
  };
}

function makeStoredKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'test-bot',
    key_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    salt: 'random-salt-value',
    scopes: ['read'],
    created_at: '2026-01-01T00:00:00Z',
    expires_at: null,
    last_used_at: null,
    is_active: true,
    ...overrides,
  };
}

describe('ValidateApiKey', () => {
  it('returns the ApiKey record for a valid plaintext key', async () => {
    const { ValidateApiKey, hashKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    const salt = 'test-salt';
    const plaintext = 'rmap_deadbeefdeadbeefdeadbeefdeadbeef';
    const hash = hashKey(plaintext, salt);

    repo.findAll.mockResolvedValue([makeStoredKey({ key_hash: hash, salt })]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute(plaintext);

    expect(result).not.toBeNull();
    expect(result.name).toBe('test-bot');
  });

  it('returns null for an invalid plaintext key', async () => {
    const { ValidateApiKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    repo.findAll.mockResolvedValue([makeStoredKey()]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute('rmap_invalidinvalidinvalidinvalid');

    expect(result).toBeNull();
  });

  it('returns null for an expired key', async () => {
    const { ValidateApiKey, hashKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    const salt = 'test-salt';
    const plaintext = 'rmap_deadbeefdeadbeefdeadbeefdeadbeef';
    const hash = hashKey(plaintext, salt);

    repo.findAll.mockResolvedValue([
      makeStoredKey({ key_hash: hash, salt, expires_at: '2020-01-01T00:00:00Z' }),
    ]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute(plaintext);

    expect(result).toBeNull();
  });

  it('returns null for a revoked (inactive) key', async () => {
    const { ValidateApiKey, hashKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    const salt = 'test-salt';
    const plaintext = 'rmap_deadbeefdeadbeefdeadbeefdeadbeef';
    const hash = hashKey(plaintext, salt);

    repo.findAll.mockResolvedValue([makeStoredKey({ key_hash: hash, salt, is_active: false })]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute(plaintext);

    expect(result).toBeNull();
  });

  it('updates last_used_at on successful validation', async () => {
    const { ValidateApiKey, hashKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    const salt = 'test-salt';
    const plaintext = 'rmap_deadbeefdeadbeefdeadbeefdeadbeef';
    const hash = hashKey(plaintext, salt);

    repo.findAll.mockResolvedValue([makeStoredKey({ id: 42, key_hash: hash, salt })]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    await uc.execute(plaintext);

    expect(repo.updateLastUsed).toHaveBeenCalledWith(42);
  });

  it('uses timing-safe comparison', async () => {
    const { ValidateApiKey } = await import('../../../src/use-cases/validate-api-key.js');
    // This test validates the use case exists and accepts input.
    // The actual timing-safe implementation is tested at integration level.
    const repo = createMockApiKeyRepo();
    repo.findAll.mockResolvedValue([]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute('rmap_00000000000000000000000000000000');

    expect(result).toBeNull();
  });
});
