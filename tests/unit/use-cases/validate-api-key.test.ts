import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the ValidateApiKey use case.
 *
 * Uses real ApiKey entity instances so the use case can call
 * instance methods like isExpired().
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

async function makeStoredKey(overrides: Record<string, unknown> = {}) {
  const { ApiKey } = await import('../../../src/domain/entities/api-key.js');
  return new ApiKey({
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
  });
}

describe('ValidateApiKey', () => {
  it('returns valid result with ApiKey for a valid plaintext key', async () => {
    const { ValidateApiKey, hashKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    const salt = 'test-salt';
    const plaintext = 'rmap_deadbeefdeadbeefdeadbeefdeadbeef';
    const hash = hashKey(plaintext, salt);

    repo.findAll.mockResolvedValue([await makeStoredKey({ key_hash: hash, salt })]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute(plaintext);

    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.key.name).toBe('test-bot');
    }
  });

  it('returns invalid for an unknown plaintext key', async () => {
    const { ValidateApiKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    repo.findAll.mockResolvedValue([await makeStoredKey()]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute('rmap_invalidinvalidinvalidinvalid');

    expect(result.status).toBe('invalid');
  });

  it('returns expired for an expired key', async () => {
    const { ValidateApiKey, hashKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    const salt = 'test-salt';
    const plaintext = 'rmap_deadbeefdeadbeefdeadbeefdeadbeef';
    const hash = hashKey(plaintext, salt);

    repo.findAll.mockResolvedValue([
      await makeStoredKey({ key_hash: hash, salt, expires_at: '2020-01-01T00:00:00Z' }),
    ]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute(plaintext);

    expect(result.status).toBe('expired');
  });

  it('returns revoked for an inactive key', async () => {
    const { ValidateApiKey, hashKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    const salt = 'test-salt';
    const plaintext = 'rmap_deadbeefdeadbeefdeadbeefdeadbeef';
    const hash = hashKey(plaintext, salt);

    repo.findAll.mockResolvedValue([
      await makeStoredKey({ key_hash: hash, salt, is_active: false }),
    ]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute(plaintext);

    expect(result.status).toBe('revoked');
  });

  it('updates last_used_at on successful validation', async () => {
    const { ValidateApiKey, hashKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    const salt = 'test-salt';
    const plaintext = 'rmap_deadbeefdeadbeefdeadbeefdeadbeef';
    const hash = hashKey(plaintext, salt);

    repo.findAll.mockResolvedValue([await makeStoredKey({ id: 42, key_hash: hash, salt })]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    await uc.execute(plaintext);

    expect(repo.updateLastUsed).toHaveBeenCalledWith(42);
  });

  it('returns invalid when no keys exist', async () => {
    const { ValidateApiKey } = await import('../../../src/use-cases/validate-api-key.js');
    const repo = createMockApiKeyRepo();
    repo.findAll.mockResolvedValue([]);

    const uc = new ValidateApiKey({ apiKeyRepo: repo });
    const result = await uc.execute('rmap_00000000000000000000000000000000');

    expect(result.status).toBe('invalid');
  });
});
