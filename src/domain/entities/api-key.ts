export type ApiKeyScope = 'read' | 'write' | 'admin';

export interface ApiKeyProps {
  id?: number;
  name: string;
  key_hash: string;
  salt: string;
  scopes: ApiKeyScope[] | string;
  created_at: string;
  is_active: boolean;
  expires_at?: string | null;
  last_used_at?: string | null;
}

/**
 * ApiKey entity — an API key for authenticating requests.
 *
 * Keys are stored as salted SHA-256 hashes, never as plaintext.
 * Each key has scopes (read, write, admin) that control access.
 */
export class ApiKey {
  readonly id: number;
  readonly name: string;
  readonly key_hash: string;
  readonly salt: string;
  readonly scopes: ApiKeyScope[];
  readonly created_at: string;
  readonly is_active: boolean;
  readonly expires_at: string | null;
  readonly last_used_at: string | null;

  static readonly SCOPES: ApiKeyScope[] = ['read', 'write', 'admin'];

  constructor(props: ApiKeyProps) {
    this.id = props.id ?? 0;
    this.name = props.name;
    this.key_hash = props.key_hash;
    this.salt = props.salt;
    this.scopes =
      typeof props.scopes === 'string' ? (JSON.parse(props.scopes) as ApiKeyScope[]) : props.scopes;
    this.created_at = props.created_at;
    this.is_active = props.is_active;
    this.expires_at = props.expires_at ?? null;
    this.last_used_at = props.last_used_at ?? null;
  }

  isExpired(): boolean {
    if (!this.expires_at) {
      return false;
    }
    return new Date(this.expires_at).getTime() < Date.now();
  }

  hasScope(scope: string): boolean {
    return this.scopes.includes(scope as ApiKeyScope);
  }

  /**
   * Safe JSON representation — excludes key_hash and salt
   * to prevent accidental exposure of secrets.
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      scopes: this.scopes,
      created_at: this.created_at,
      is_active: this.is_active,
      expires_at: this.expires_at,
      last_used_at: this.last_used_at,
    };
  }
}
