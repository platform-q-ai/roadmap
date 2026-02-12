import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the GenerateApiKey use case.
 *
 * The module doesn't exist yet (Phase 5) — dynamic import() ensures
 * tests fail with "module not found" rather than compile-time errors.
 */

interface MockApiKeyRepo {
  save: ReturnType<typeof vi.fn>;
  findByName: ReturnType<typeof vi.fn>;
  findByHash: ReturnType<typeof vi.fn>;
  findAll: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
  updateLastUsed: ReturnType<typeof vi.fn>;
}

function createMockApiKeyRepo(existingNames: string[] = []): MockApiKeyRepo {
  return {
    save: vi.fn(),
    findByName: vi
      .fn()
      .mockImplementation(async (name: string) => (existingNames.includes(name) ? { name } : null)),
    findByHash: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    revoke: vi.fn(),
    updateLastUsed: vi.fn(),
  };
}

describe('GenerateApiKey', () => {
  it('generates a key with rmap_ prefix followed by 32 hex characters', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    const result = await uc.execute({ name: 'test-bot', scopes: ['read'] });

    expect(result.plaintext).toMatch(/^rmap_[a-f0-9]{32}$/);
  });

  it('saves a hashed key, not the plaintext', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    const result = await uc.execute({ name: 'test-bot', scopes: ['read'] });

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.key_hash).toBeDefined();
    expect(saved.key_hash).not.toBe(result.plaintext);
    expect(saved.key_hash).toHaveLength(64); // SHA-256 hex
  });

  it('includes a unique salt in the saved record', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    await uc.execute({ name: 'test-bot', scopes: ['read'] });

    const saved = repo.save.mock.calls[0][0];
    expect(saved.salt).toBeDefined();
    expect(typeof saved.salt).toBe('string');
    expect(saved.salt.length).toBeGreaterThan(0);
  });

  it('assigns the requested scopes', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    await uc.execute({ name: 'write-bot', scopes: ['read', 'write'] });

    const saved = repo.save.mock.calls[0][0];
    expect(saved.scopes).toEqual(['read', 'write']);
  });

  it('throws when a key with the same name already exists', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo(['existing-bot']);
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    await expect(uc.execute({ name: 'existing-bot', scopes: ['read'] })).rejects.toThrow(
      /already exists/i
    );
  });

  it('supports optional expiry date', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    const expiry = '2030-12-31T00:00:00Z';
    await uc.execute({ name: 'expiring', scopes: ['read'], expiresAt: expiry });

    const saved = repo.save.mock.calls[0][0];
    expect(saved.expires_at).toBe(expiry);
  });

  it('defaults is_active to true', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    await uc.execute({ name: 'active-key', scopes: ['read'] });

    const saved = repo.save.mock.calls[0][0];
    expect(saved.is_active).toBe(true);
  });

  it('returns the saved record alongside the plaintext', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    const result = await uc.execute({ name: 'test-bot', scopes: ['read'] });

    expect(result).toHaveProperty('plaintext');
    expect(result).toHaveProperty('record');
    expect(result.record.name).toBe('test-bot');
  });

  it('uses pre-set plaintext when provided', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    const result = await uc.execute({
      name: 'preset-key',
      scopes: ['read'],
      plaintext: 'rmap_preset_abc123def456',
    });

    expect(result.plaintext).toBe('rmap_preset_abc123def456');
  });

  it('hashes the pre-set plaintext with a deterministic salt', async () => {
    const { GenerateApiKey, hashKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    await uc.execute({
      name: 'det-key',
      scopes: ['read'],
      plaintext: 'rmap_fixed_key_value',
    });

    const saved = repo.save.mock.calls[0][0];
    const expectedHash = hashKey('rmap_fixed_key_value', saved.salt);
    expect(saved.key_hash).toBe(expectedHash);
  });

  it('produces identical hashes for same plaintext across calls', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo1 = createMockApiKeyRepo();
    const uc1 = new GenerateApiKey({ apiKeyRepo: repo1 });
    await uc1.execute({
      name: 'stable',
      scopes: ['read'],
      plaintext: 'rmap_stable_key',
    });
    const saved1 = repo1.save.mock.calls[0][0];

    // Second call — same plaintext, different repo (simulates fresh DB)
    const repo2 = createMockApiKeyRepo();
    const uc2 = new GenerateApiKey({ apiKeyRepo: repo2 });
    await uc2.execute({
      name: 'stable',
      scopes: ['read'],
      plaintext: 'rmap_stable_key',
    });
    const saved2 = repo2.save.mock.calls[0][0];

    // Salt is derived from plaintext, so both should match
    expect(saved1.salt).toBe(saved2.salt);
    expect(saved1.key_hash).toBe(saved2.key_hash);
  });

  it('rejects pre-set plaintext that does not start with rmap_', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    await expect(
      uc.execute({ name: 'bad-prefix', scopes: ['read'], plaintext: 'invalid_prefix' })
    ).rejects.toThrow(/must start with rmap_/i);
  });

  it('rejects empty pre-set plaintext', async () => {
    const { GenerateApiKey } = await import('../../../src/use-cases/generate-api-key.js');
    const repo = createMockApiKeyRepo();
    const uc = new GenerateApiKey({ apiKeyRepo: repo });

    await expect(uc.execute({ name: 'empty', scopes: ['read'], plaintext: '' })).rejects.toThrow(
      /must start with rmap_/i
    );
  });
});
