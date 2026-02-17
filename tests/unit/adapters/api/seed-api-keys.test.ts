import { describe, expect, it, vi } from 'vitest';

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

  it('maps optional key field to plaintext in parsed entries', () => {
    const raw = JSON.stringify([
      { name: 'keyed', scopes: ['read'], key: 'rmap_fixed_abc' },
      { name: 'unkeyed', scopes: ['read'] },
    ]);
    const entries = parseSeedEntries(raw);
    expect(entries[0]).toEqual({
      name: 'keyed',
      scopes: ['read'],
      plaintext: 'rmap_fixed_abc',
    });
    expect(entries[1]).toEqual({ name: 'unkeyed', scopes: ['read'] });
    expect(entries[1]).not.toHaveProperty('plaintext');
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

  it('generates keys and logs masked output for new entries', async () => {
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
    expect(log).toHaveBeenCalledWith('  Seeded key "admin": rmap_******');
    expect(log).toHaveBeenCalledWith('  Seeded key "reader": rmap_******');
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
    // Only the new key should be logged (masked)
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('  Seeded key "new-key": rmap_******');
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

  it('passes explicit key through to generate.execute as plaintext', async () => {
    const generate = {
      execute: vi.fn().mockResolvedValue({ plaintext: 'rmap_explicit_key' }),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'keyed', scopes: ['read'], key: 'rmap_explicit_key' }]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(generate.execute).toHaveBeenCalledWith({
      name: 'keyed',
      scopes: ['read'],
      plaintext: 'rmap_explicit_key',
    });
  });

  it('does not pass plaintext when no key field in entry', async () => {
    const generate = {
      execute: vi.fn().mockResolvedValue({ plaintext: 'rmap_random' }),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'unkeyed', scopes: ['read'] }]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(generate.execute).toHaveBeenCalledWith({
      name: 'unkeyed',
      scopes: ['read'],
    });
  });

  it('masks deterministic key in log output', async () => {
    const generate = {
      execute: vi.fn().mockResolvedValue({ plaintext: 'rmap_abcdef1234567890abcdef1234567890' }),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([
      { name: 'det', scopes: ['read'], key: 'rmap_abcdef1234567890abcdef1234567890' },
    ]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(log).toHaveBeenCalledTimes(1);
    const logMsg = log.mock.calls[0][0] as string;
    expect(logMsg).toContain('"det"');
    expect(logMsg).not.toContain('rmap_abcdef1234567890abcdef1234567890');
    expect(logMsg).toMatch(/rmap_abcdef\.\.\.567890/);
  });

  it('masks short deterministic key with asterisks', async () => {
    const generate = {
      execute: vi.fn().mockResolvedValue({ plaintext: 'rmap_short' }),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'short', scopes: ['read'], key: 'rmap_short' }]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(log).toHaveBeenCalledTimes(1);
    const logMsg = log.mock.calls[0][0] as string;
    expect(logMsg).toContain('rmap_******');
    expect(logMsg).not.toContain('rmap_short');
  });

  it('masks random keys in log output (never shows plaintext)', async () => {
    const generate = {
      execute: vi.fn().mockResolvedValue({ plaintext: 'rmap_random_key_full_value' }),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'rnd', scopes: ['read'] }]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(log).toHaveBeenCalledTimes(1);
    const logMsg = log.mock.calls[0][0] as string;
    expect(logMsg).not.toContain('rmap_random_key_full_value');
    expect(logMsg).toMatch(/rmap_random\.\.\._value/);
  });

  it('rejects seed entries with invalid key format', async () => {
    const generate = {
      execute: vi.fn().mockRejectedValue(new Error('Key must start with rmap_')),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'bad', scopes: ['read'], key: 'invalid_prefix' }]);

    await expect(seedApiKeys({ rawEnv, generate, log })).rejects.toThrow(
      'Key must start with rmap_'
    );
  });
});
