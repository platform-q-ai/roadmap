import { describe, it, expect, vi } from 'vitest';

import { parseSeedEntries, seedApiKeys } from '../../../../src/adapters/api/index.js';
import { ValidationError } from '../../../../src/use-cases/index.js';

describe('parseSeedEntries', () => {
  it('parses valid JSON array of seed entries', () => {
    const raw = JSON.stringify([
      { name: 'admin', scopes: ['read', 'write', 'admin'] },
      { name: 'reader', scopes: ['read'] },
    ]);
    const entries = parseSeedEntries(raw);
    expect(entries).toEqual([
      { name: 'admin', scopes: ['read', 'write', 'admin'] },
      { name: 'reader', scopes: ['read'] },
    ]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSeedEntries('not-json')).toThrow('API_KEY_SEED is not valid JSON');
  });

  it('throws when JSON is not an array', () => {
    expect(() => parseSeedEntries('{"name":"x"}')).toThrow('API_KEY_SEED must be a JSON array');
  });

  it('throws when entry is missing name', () => {
    expect(() => parseSeedEntries('[{"scopes":["read"]}]')).toThrow(
      'API_KEY_SEED[0]: requires "name" (string) and "scopes" (array)'
    );
  });

  it('throws when entry is missing scopes', () => {
    expect(() => parseSeedEntries('[{"name":"x"}]')).toThrow(
      'API_KEY_SEED[0]: requires "name" (string) and "scopes" (array)'
    );
  });

  it('throws with correct index for invalid entry', () => {
    const raw = JSON.stringify([
      { name: 'ok', scopes: ['read'] },
      { name: 123, scopes: ['read'] },
    ]);
    expect(() => parseSeedEntries(raw)).toThrow('API_KEY_SEED[1]');
  });
});

describe('seedApiKeys', () => {
  function mockGenerate(results: Map<string, string>) {
    return {
      execute: vi.fn(async (input: { name: string }) => {
        const plaintext = results.get(input.name);
        if (!plaintext) {
          throw new ValidationError(`API key already exists: ${input.name}`);
        }
        return { plaintext };
      }),
    };
  }

  it('does nothing when rawEnv is undefined', async () => {
    const generate = { execute: vi.fn() };
    const log = vi.fn();
    await seedApiKeys({ rawEnv: undefined, generate, log });
    expect(generate.execute).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('does nothing when rawEnv is empty string', async () => {
    const generate = { execute: vi.fn() };
    const log = vi.fn();
    await seedApiKeys({ rawEnv: '', generate, log });
    expect(generate.execute).not.toHaveBeenCalled();
  });

  it('generates keys and logs plaintext for new entries', async () => {
    const results = new Map([
      ['admin', 'rmap_abc123'],
      ['reader', 'rmap_def456'],
    ]);
    const generate = mockGenerate(results);
    const log = vi.fn();
    const rawEnv = JSON.stringify([
      { name: 'admin', scopes: ['read', 'write', 'admin'] },
      { name: 'reader', scopes: ['read'] },
    ]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(generate.execute).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith('  Seeded key "admin": rmap_abc123');
    expect(log).toHaveBeenCalledWith('  Seeded key "reader": rmap_def456');
  });

  it('silently skips existing keys (ValidationError)', async () => {
    const results = new Map([['new-key', 'rmap_new123']]);
    const generate = mockGenerate(results);
    const log = vi.fn();
    const rawEnv = JSON.stringify([
      { name: 'existing', scopes: ['read'] },
      { name: 'new-key', scopes: ['read'] },
    ]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(generate.execute).toHaveBeenCalledTimes(2);
    // Only the new key should be logged
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('  Seeded key "new-key": rmap_new123');
  });

  it('re-throws non-ValidationError exceptions', async () => {
    const generate = {
      execute: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'fail', scopes: ['read'] }]);

    await expect(seedApiKeys({ rawEnv, generate, log })).rejects.toThrow('DB connection lost');
  });

  it('throws on malformed JSON in rawEnv', async () => {
    const generate = { execute: vi.fn() };
    const log = vi.fn();

    await expect(seedApiKeys({ rawEnv: '{bad', generate, log })).rejects.toThrow(
      'API_KEY_SEED is not valid JSON'
    );
  });
});
