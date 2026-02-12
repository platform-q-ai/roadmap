import { createHash, randomBytes } from 'node:crypto';

import type { ApiKeyScope, IApiKeyRepository } from '../domain/index.js';
import { ApiKey } from '../domain/index.js';

import { ValidationError } from './errors.js';

export interface GenerateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
  /** Pre-determined plaintext key. When provided, the key and its salt are
   *  deterministic so the same seed always produces the same hash.
   *  Must start with "rmap_". */
  plaintext?: string;
}

export interface GenerateApiKeyResult {
  plaintext: string;
  record: ReturnType<ApiKey['toJSON']>;
}

interface Deps {
  apiKeyRepo: IApiKeyRepository;
}

/**
 * Hash a plaintext API key with the given salt using SHA-256.
 * Exported for use by ValidateApiKey.
 */
export function hashKey(plaintext: string, salt: string): string {
  return createHash('sha256')
    .update(salt + plaintext)
    .digest('hex');
}

/**
 * GenerateApiKey use case.
 *
 * Generates a new API key with the format rmap_<32 hex chars>.
 * Stores the salted SHA-256 hash, never the plaintext.
 * Returns the plaintext once — it cannot be retrieved again.
 */
export class GenerateApiKey {
  private readonly apiKeyRepo: IApiKeyRepository;

  constructor({ apiKeyRepo }: Deps) {
    this.apiKeyRepo = apiKeyRepo;
  }

  async execute(input: GenerateApiKeyInput): Promise<GenerateApiKeyResult> {
    const existing = await this.apiKeyRepo.findByName(input.name);
    if (existing) {
      throw new ValidationError(`API key already exists: ${input.name}`);
    }

    if (input.plaintext !== undefined && !input.plaintext.startsWith('rmap_')) {
      throw new ValidationError('Pre-set key must start with rmap_');
    }

    const plaintext = input.plaintext ?? `rmap_${randomBytes(16).toString('hex')}`;

    // When a pre-set plaintext is provided, derive the salt deterministically
    // from the key so the same seed always produces the same hash.
    const salt = input.plaintext
      ? createHash('sha256').update(plaintext).digest('hex').slice(0, 32)
      : randomBytes(16).toString('hex');

    const key_hash = hashKey(plaintext, salt);

    const props = {
      name: input.name,
      key_hash,
      salt,
      scopes: input.scopes,
      created_at: new Date().toISOString(),
      is_active: true,
      expires_at: input.expiresAt ?? null,
    };

    await this.apiKeyRepo.save(props);

    const record = new ApiKey({ ...props, id: 0 });

    return {
      plaintext,
      record: record.toJSON(),
    };
  }
}
