import type { IApiKeyRepository } from '../domain/index.js';
import type { ApiKey } from '../domain/index.js';

interface Deps {
  apiKeyRepo: IApiKeyRepository;
}

/**
 * ListApiKeys use case.
 *
 * Returns all API keys with sensitive fields (key_hash, salt)
 * excluded via toJSON(). Used by the admin management endpoint.
 */
export class ListApiKeys {
  private readonly apiKeyRepo: IApiKeyRepository;

  constructor({ apiKeyRepo }: Deps) {
    this.apiKeyRepo = apiKeyRepo;
  }

  async execute(): Promise<ReturnType<ApiKey['toJSON']>[]> {
    const keys = await this.apiKeyRepo.findAll();
    return keys.map(k => k.toJSON());
  }
}
