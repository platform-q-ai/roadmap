import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the RevokeApiKey use case.
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
    key_hash: 'abc123',
    salt: 'salt123',
    scopes: ['read'],
    created_at: '2026-01-01T00:00:00Z',
    expires_at: null,
    last_used_at: null,
    is_active: true,
    ...overrides,
  };
}

describe('RevokeApiKey', () => {
  it('revokes an existing active key by id', async () => {
    const { RevokeApiKey } = await import('../../../src/use-cases/revoke-api-key.js');
    const repo = createMockApiKeyRepo();
    repo.findById.mockResolvedValue(makeStoredKey({ id: 5 }));

    const uc = new RevokeApiKey({ apiKeyRepo: repo });
    await uc.execute(5);

    expect(repo.revoke).toHaveBeenCalledWith(5);
  });

  it('throws when key id does not exist', async () => {
    const { RevokeApiKey } = await import('../../../src/use-cases/revoke-api-key.js');
    const repo = createMockApiKeyRepo();
    repo.findById.mockResolvedValue(null);

    const uc = new RevokeApiKey({ apiKeyRepo: repo });
    await expect(uc.execute(999)).rejects.toThrow(/not found/i);
  });

  it('throws when key is already revoked', async () => {
    const { RevokeApiKey } = await import('../../../src/use-cases/revoke-api-key.js');
    const repo = createMockApiKeyRepo();
    repo.findById.mockResolvedValue(makeStoredKey({ id: 5, is_active: false }));

    const uc = new RevokeApiKey({ apiKeyRepo: repo });
    await expect(uc.execute(5)).rejects.toThrow(/already revoked/i);
  });
});
