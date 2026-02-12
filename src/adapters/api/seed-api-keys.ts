/**
 * Runtime API key seeding from environment variables.
 *
 * Reads API_KEY_SEED (JSON array of {name, scopes}) and generates keys
 * for any names not already in the database. Plaintext keys are logged
 * to stderr once — save them immediately; they cannot be retrieved later.
 */

import type { ApiKeyScope, GenerateApiKeyInput } from '../../use-cases/index.js';
import { ValidationError } from '../../use-cases/index.js';

export interface SeedApiKeysDeps {
  rawEnv: string | undefined;
  generate: { execute: (input: GenerateApiKeyInput) => Promise<{ plaintext: string }> };
  log: (msg: string) => void;
}

export function parseSeedEntries(raw: string): GenerateApiKeyInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('API_KEY_SEED is not valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('API_KEY_SEED must be a JSON array');
  }
  return parsed.map((entry: unknown, i: number) => {
    const obj = entry as Record<string, unknown>;
    if (typeof obj.name !== 'string' || !Array.isArray(obj.scopes)) {
      throw new Error(`API_KEY_SEED[${i}]: requires "name" (string) and "scopes" (array)`);
    }
    return { name: obj.name, scopes: obj.scopes as ApiKeyScope[] };
  });
}

export async function seedApiKeys(deps: SeedApiKeysDeps): Promise<void> {
  if (!deps.rawEnv) {
    return;
  }
  const entries = parseSeedEntries(deps.rawEnv);
  for (const entry of entries) {
    try {
      const result = await deps.generate.execute(entry);
      deps.log(`  Seeded key "${entry.name}": ${result.plaintext}`);
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        // Key already exists — skip silently (idempotent)
        continue;
      }
      throw err;
    }
  }
}
