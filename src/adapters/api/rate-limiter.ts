export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
}

interface BucketEntry {
  count: number;
  resetAt: number; // epoch ms
}

export interface RateLimiterOptions {
  defaultLimit?: number;
  writeLimit?: number;
  windowMs?: number;
  keyLimits?: Record<string, number>;
}

const DEFAULT_LIMIT = 100;
const DEFAULT_WRITE_LIMIT = 20;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const HEALTH_KEY = '__health__';

/**
 * In-memory rate limiter using sliding window counters.
 *
 * Each API key gets its own counter. Rate limit state is not
 * persisted — restarting the server resets all counters.
 */
export class RateLimiter {
  private readonly defaultLimit: number;
  private readonly writeLimit: number;
  private readonly windowMs: number;
  private readonly keyLimits: Record<string, number>;
  private readonly buckets: Map<string, BucketEntry> = new Map();

  constructor(options?: RateLimiterOptions) {
    this.defaultLimit = options?.defaultLimit ?? DEFAULT_LIMIT;
    this.writeLimit = options?.writeLimit ?? DEFAULT_WRITE_LIMIT;
    this.windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    this.keyLimits = options?.keyLimits ?? {};
  }

  /**
   * Check (and increment) the read rate limit for a key.
   */
  check(key: string): RateLimitResult {
    // Health endpoint is always exempt
    if (key === HEALTH_KEY) {
      return {
        allowed: true,
        limit: this.defaultLimit,
        remaining: this.defaultLimit,
        reset: Math.ceil((Date.now() + this.windowMs) / 1000),
      };
    }

    const limit = this.keyLimits[key] ?? this.defaultLimit;
    return this.checkBucket(`read:${key}`, limit);
  }

  /**
   * Check (and increment) the write rate limit for a key.
   */
  checkWrite(key: string): RateLimitResult {
    const limit = this.keyLimits[key] ?? this.writeLimit;
    return this.checkBucket(`write:${key}`, limit);
  }

  private checkBucket(bucketKey: string, limit: number): RateLimitResult {
    const now = Date.now();
    let entry = this.buckets.get(bucketKey);

    // Reset if window expired
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(bucketKey, entry);
    }

    entry.count++;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);
    const reset = Math.ceil(entry.resetAt / 1000);

    return { allowed, limit, remaining, reset };
  }
}
