import type { ApiKey, ApiKeyProps } from '../entities/api-key.js';

/**
 * Repository interface for API key persistence.
 *
 * Defined in the domain layer; implemented in infrastructure.
 */
export interface IApiKeyRepository {
  save(props: Omit<ApiKeyProps, 'id'>): Promise<void>;
  findAll(): Promise<ApiKey[]>;
  findById(id: number): Promise<ApiKey | null>;
  findByName(name: string): Promise<ApiKey | null>;
  revoke(id: number): Promise<void>;
  updateLastUsed(id: number): Promise<void>;
}
