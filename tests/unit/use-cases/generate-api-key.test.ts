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
});
