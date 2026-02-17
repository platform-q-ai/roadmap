import { describe, expect, it, vi } from 'vitest';

import { seedApiKeys } from '../../../../src/adapters/api/index.js';

describe('API key masking — all keys masked in logs', () => {
  it('masks auto-generated (random) keys in log output', async () => {
    const plaintext = 'rmap_random9876543210abcdef9876543210';
    const generate = {
      execute: vi.fn().mockResolvedValue({ plaintext }),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'rnd', scopes: ['read'] }]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(log).toHaveBeenCalledTimes(1);
    const logMsg = log.mock.calls[0][0] as string;
    expect(logMsg).not.toContain(plaintext);
    expect(logMsg).toMatch(/rmap_random\.\.\.543210/);
  });

  it('masks deterministic keys in log output', async () => {
    const plaintext = 'rmap_abcdef1234567890abcdef1234567890';
    const generate = {
      execute: vi.fn().mockResolvedValue({ plaintext }),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'det', scopes: ['read'], key: plaintext }]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(log).toHaveBeenCalledTimes(1);
    const logMsg = log.mock.calls[0][0] as string;
    expect(logMsg).not.toContain(plaintext);
    expect(logMsg).toMatch(/rmap_abcdef\.\.\.567890/);
  });

  it('masks short keys with asterisks regardless of source', async () => {
    const plaintext = 'rmap_tiny';
    const generate = {
      execute: vi.fn().mockResolvedValue({ plaintext }),
    };
    const log = vi.fn();
    const rawEnv = JSON.stringify([{ name: 'short', scopes: ['read'] }]);

    await seedApiKeys({ rawEnv, generate, log });

    expect(log).toHaveBeenCalledTimes(1);
    const logMsg = log.mock.calls[0][0] as string;
    expect(logMsg).toContain('rmap_******');
    expect(logMsg).not.toContain('rmap_tiny');
  });
});
