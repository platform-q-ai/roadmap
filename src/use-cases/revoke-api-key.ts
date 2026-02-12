import type { IApiKeyRepository } from '../domain/index.js';

import { ValidationError } from './errors.js';

interface Deps {
  apiKeyRepo: IApiKeyRepository;
}

/**
 * RevokeApiKey use case.
 *
 * Sets is_active to false on the key, preventing further use.
 * Throws if the key doesn't exist or is already revoked.
 */
export class RevokeApiKey {
  private readonly apiKeyRepo: IApiKeyRepository;

  constructor({ apiKeyRepo }: Deps) {
    this.apiKeyRepo = apiKeyRepo;
  }

  async execute(keyId: number): Promise<void> {
    const key = await this.apiKeyRepo.findById(keyId);
    if (!key) {
      throw new ValidationError(`API key not found: ${keyId}`);
    }
    if (!key.is_active) {
      throw new ValidationError(`API key already revoked: ${keyId}`);
    }

    await this.apiKeyRepo.revoke(keyId);
  }
}
