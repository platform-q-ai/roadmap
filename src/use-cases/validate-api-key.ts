import { timingSafeEqual } from 'node:crypto';

import type { ApiKey, IApiKeyRepository } from '../domain/index.js';

import { hashKey } from './generate-api-key.js';

// Re-export hashKey for test convenience
export { hashKey } from './generate-api-key.js';

export type ValidateResult =
  | { status: 'valid'; key: ApiKey }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'revoked' };

interface Deps {
  apiKeyRepo: IApiKeyRepository;
}

/**
 * ValidateApiKey use case.
 *
 * Validates a plaintext API key against stored hashes.
 * Uses timing-safe comparison to prevent timing attacks.
 * Returns a discriminated result with the reason for failure.
 */
export class ValidateApiKey {
  private readonly apiKeyRepo: IApiKeyRepository;

  constructor({ apiKeyRepo }: Deps) {
    this.apiKeyRepo = apiKeyRepo;
  }

  async execute(plaintext: string): Promise<ValidateResult> {
    const allKeys = await this.apiKeyRepo.findAll();

    for (const key of allKeys) {
      const candidateHash = hashKey(plaintext, key.salt);
      const candidateBuf = Buffer.from(candidateHash, 'hex');
      const storedBuf = Buffer.from(key.key_hash, 'hex');

      if (candidateBuf.length !== storedBuf.length) {
        continue;
      }

      if (timingSafeEqual(candidateBuf, storedBuf)) {
        if (!key.is_active) {
          return { status: 'revoked' };
        }

        if (key.isExpired()) {
          return { status: 'expired' };
        }

        await this.apiKeyRepo.updateLastUsed(key.id);
        return { status: 'valid', key };
      }
    }

    return { status: 'invalid' };
  }
}
