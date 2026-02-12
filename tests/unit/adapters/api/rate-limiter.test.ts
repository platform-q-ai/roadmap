import { describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for the rate limiter.
 *
 * Module doesn't exist yet (Phase 5) — dynamic import ensures RED.
 */

describe('RateLimiter', () => {
  it('allows requests within the default limit (100/min)', async () => {
    const { RateLimiter } = await import('../../../../src/adapters/api/rate-limiter.js');
    const limiter = new RateLimiter();

    const result = limiter.check('key-1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(result.limit).toBe(100);
  });

  it('returns rate limit headers data', async () => {
    const { RateLimiter } = await import('../../../../src/adapters/api/rate-limiter.js');
    const limiter = new RateLimiter();

    const result = limiter.check('key-1');

    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('reset');
    expect(typeof result.reset).toBe('number');
  });

  it('blocks requests exceeding the limit', async () => {
    const { RateLimiter } = await import('../../../../src/adapters/api/rate-limiter.js');
    const limiter = new RateLimiter({ defaultLimit: 3 });

    limiter.check('key-1');
    limiter.check('key-1');
    limiter.check('key-1');
    const fourth = limiter.check('key-1');

    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('tracks different keys independently', async () => {
    const { RateLimiter } = await import('../../../../src/adapters/api/rate-limiter.js');
    const limiter = new RateLimiter({ defaultLimit: 2 });

    limiter.check('key-a');
    limiter.check('key-a');
    const thirdA = limiter.check('key-a');
    const firstB = limiter.check('key-b');

    expect(thirdA.allowed).toBe(false);
    expect(firstB.allowed).toBe(true);
  });

  it('resets count after window expires', async () => {
    const { RateLimiter } = await import('../../../../src/adapters/api/rate-limiter.js');
    const limiter = new RateLimiter({ defaultLimit: 1, windowMs: 100 });

    const first = limiter.check('key-1');
    expect(first.allowed).toBe(true);

    const second = limiter.check('key-1');
    expect(second.allowed).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    const third = limiter.check('key-1');
    expect(third.allowed).toBe(true);
  });

  it('supports per-key custom limits', async () => {
    const { RateLimiter } = await import('../../../../src/adapters/api/rate-limiter.js');
    const limiter = new RateLimiter({
      defaultLimit: 100,
      keyLimits: { 'special-key': 2 },
    });

    limiter.check('special-key');
    limiter.check('special-key');
    const third = limiter.check('special-key');

    expect(third.allowed).toBe(false);
  });

  it('exempts health endpoint checks (no key needed)', async () => {
    const { RateLimiter } = await import('../../../../src/adapters/api/rate-limiter.js');
    const limiter = new RateLimiter({ defaultLimit: 1 });

    // Health checks should use a special exempt path
    const result = limiter.check('__health__');

    // Health is always allowed (or limiter skips it)
    expect(result.allowed).toBe(true);
  });

  it('applies stricter limits for write operations', async () => {
    const { RateLimiter } = await import('../../../../src/adapters/api/rate-limiter.js');
    const limiter = new RateLimiter({ defaultLimit: 100, writeLimit: 20 });

    // Write operations use a separate counter
    for (let i = 0; i < 20; i++) {
      const res = limiter.checkWrite('key-1');
      expect(res.allowed).toBe(true);
    }
    const overLimit = limiter.checkWrite('key-1');
    expect(overLimit.allowed).toBe(false);
  });
});
