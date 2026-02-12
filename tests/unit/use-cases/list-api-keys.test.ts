import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the ListApiKeys use case.
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

async function makeStoredKey(overrides: Record<string, unknown> = {}) {
  const { ApiKey } = await import('../../../src/domain/entities/api-key.js');
  return new ApiKey({
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
  });
}

describe('ListApiKeys', () => {
  it('returns all keys from the repository', async () => {
    const { ListApiKeys } = await import('../../../src/use-cases/list-api-keys.js');
    const repo = createMockApiKeyRepo();
    repo.findAll.mockResolvedValue([
      await makeStoredKey({ id: 1, name: 'key-a' }),
      await makeStoredKey({ id: 2, name: 'key-b' }),
    ]);

    const uc = new ListApiKeys({ apiKeyRepo: repo });
    const result = await uc.execute();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('key-a');
    expect(result[1].name).toBe('key-b');
  });

  it('returns empty array when no keys exist', async () => {
    const { ListApiKeys } = await import('../../../src/use-cases/list-api-keys.js');
    const repo = createMockApiKeyRepo();
    repo.findAll.mockResolvedValue([]);

    const uc = new ListApiKeys({ apiKeyRepo: repo });
    const result = await uc.execute();

    expect(result).toEqual([]);
  });

  it('does not expose key_hash or salt in returned records', async () => {
    const { ListApiKeys } = await import('../../../src/use-cases/list-api-keys.js');
    const repo = createMockApiKeyRepo();
    repo.findAll.mockResolvedValue([await makeStoredKey()]);

    const uc = new ListApiKeys({ apiKeyRepo: repo });
    const result = await uc.execute();

    expect(result).toHaveLength(1);
    const json = JSON.stringify(result[0]);
    expect(json).not.toContain('key_hash');
    expect(json).not.toContain('salt');
  });
});
