import { describe, expect, it } from 'vitest';

// ApiKey entity will be created in phase 5
// import { ApiKey } from '@domain/entities/api-key.js';

describe('ApiKey Entity', () => {
  describe('construction', () => {
    it('should create an ApiKey with required fields', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test-bot',
        key_hash: 'abc123hash',
        salt: 'random-salt',
        scopes: ['read'],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
      });
      expect(key.id).toBe(1);
      expect(key.name).toBe('test-bot');
      expect(key.key_hash).toBe('abc123hash');
      expect(key.salt).toBe('random-salt');
      expect(key.scopes).toEqual(['read']);
      expect(key.is_active).toBe(true);
    });

    it('should parse scopes from JSON string', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'h',
        salt: 's',
        scopes: '["read","write"]' as unknown as string[],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
      });
      expect(key.scopes).toEqual(['read', 'write']);
    });

    it('should default expires_at to null', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'h',
        salt: 's',
        scopes: ['read'],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
      });
      expect(key.expires_at).toBeNull();
    });

    it('should default last_used_at to null', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'h',
        salt: 's',
        scopes: ['read'],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
      });
      expect(key.last_used_at).toBeNull();
    });
  });

  describe('isExpired', () => {
    it('should return false when expires_at is null', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'h',
        salt: 's',
        scopes: ['read'],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
        expires_at: null,
      });
      expect(key.isExpired()).toBe(false);
    });

    it('should return true when expires_at is in the past', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'h',
        salt: 's',
        scopes: ['read'],
        created_at: '2020-01-01T00:00:00Z',
        is_active: true,
        expires_at: '2020-06-01T00:00:00Z',
      });
      expect(key.isExpired()).toBe(true);
    });

    it('should return false when expires_at is in the future', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'h',
        salt: 's',
        scopes: ['read'],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
        expires_at: '2030-12-31T00:00:00Z',
      });
      expect(key.isExpired()).toBe(false);
    });
  });

  describe('hasScope', () => {
    it('should return true for a scope the key has', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'h',
        salt: 's',
        scopes: ['read', 'write'],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
      });
      expect(key.hasScope('read')).toBe(true);
      expect(key.hasScope('write')).toBe(true);
    });

    it('should return false for a scope the key lacks', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'h',
        salt: 's',
        scopes: ['read'],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
      });
      expect(key.hasScope('write')).toBe(false);
      expect(key.hasScope('admin')).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should exclude key_hash and salt from JSON output', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      const key = new ApiKey({
        id: 1,
        name: 'test',
        key_hash: 'secret_hash',
        salt: 'secret_salt',
        scopes: ['read'],
        created_at: '2026-01-01T00:00:00Z',
        is_active: true,
      });
      const json = key.toJSON();
      expect(json).not.toHaveProperty('key_hash');
      expect(json).not.toHaveProperty('salt');
      expect(json).toHaveProperty('name', 'test');
      expect(json).toHaveProperty('scopes');
    });
  });

  describe('SCOPES', () => {
    it('should define valid scopes', async () => {
      const { ApiKey } = await import('../../../../src/domain/entities/api-key.js');
      expect(ApiKey.SCOPES).toContain('read');
      expect(ApiKey.SCOPES).toContain('write');
      expect(ApiKey.SCOPES).toContain('admin');
    });
  });
});
