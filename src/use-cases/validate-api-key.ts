import { timingSafeEqual } from 'node:crypto';

import type { ApiKey, IApiKeyRepository } from '../domain/index.js';

import { hashKey } from './generate-api-key.js';

// Re-export hashKey for test convenience
export { hashKey } from './generate-api-key.js';

interface Deps {
  apiKeyRepo: IApiKeyRepository;
}

/**
 * ValidateApiKey use case.
 *
 * Validates a plaintext API key against stored hashes.
 * Uses timing-safe comparison to prevent timing attacks.
 * Returns the ApiKey record if valid, null otherwise.
 * Also rejects expired and revoked keys.
 */
export class ValidateApiKey {
  private readonly apiKeyRepo: IApiKeyRepository;

  constructor({ apiKeyRepo }: Deps) {
    this.apiKeyRepo = apiKeyRepo;
  }

  async execute(plaintext: string): Promise<ApiKey | null> {
    const allKeys = await this.apiKeyRepo.findAll();

    for (const key of allKeys) {
      if (!key.is_active) {
        continue;
      }

      const candidateHash = hashKey(plaintext, key.salt);
      const candidateBuf = Buffer.from(candidateHash, 'hex');
      const storedBuf = Buffer.from(key.key_hash, 'hex');

      if (candidateBuf.length !== storedBuf.length) {
        continue;
      }

      if (timingSafeEqual(candidateBuf, storedBuf)) {
        if (key.isExpired()) {
          return null;
        }

        await this.apiKeyRepo.updateLastUsed(key.id);
        return key;
      }
    }

    return null;
  }
}
