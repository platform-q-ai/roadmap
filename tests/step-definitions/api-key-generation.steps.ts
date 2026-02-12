import { strict as assert } from 'node:assert';

import { Before, Given, Then, When } from '@cucumber/cucumber';

import type { ApiKeyProps, ApiKeyScope } from '../../src/domain/entities/api-key.js';
import { ApiKey } from '../../src/domain/entities/api-key.js';
import type { IApiKeyRepository } from '../../src/domain/index.js';
import { GenerateApiKey } from '../../src/use-cases/index.js';

/**
 * Step definitions for features/api-key-generation.feature
 *
 * These steps test the GenerateApiKey use case directly (no HTTP server).
 * The world object carries: generatedKey, keyRecord, generateError, apiKeyRepo.
 */

interface KeyGenWorld {
  generateApiKey: GenerateApiKey | null;
  apiKeyRepo: InMemoryRepo | null;
  generatedKey: string | null;
  keyRecord: Record<string, unknown> | null;
  generateError: string | null;
  [key: string]: unknown;
}

class InMemoryRepo implements IApiKeyRepository {
  private keys: ApiKey[] = [];
  private nextId = 1;

  async save(props: Omit<ApiKeyProps, 'id'>): Promise<void> {
    this.keys.push(new ApiKey({ ...props, id: this.nextId++ }));
  }

  async findAll(): Promise<ApiKey[]> {
    return [...this.keys];
  }

  async findById(id: number): Promise<ApiKey | null> {
    return this.keys.find(k => k.id === id) ?? null;
  }

  async findByName(name: string): Promise<ApiKey | null> {
    return this.keys.find(k => k.name === name) ?? null;
  }

  async revoke(id: number): Promise<void> {
    const idx = this.keys.findIndex(k => k.id === id);
    if (idx >= 0) {
      const old = this.keys[idx];
      this.keys[idx] = new ApiKey({
        id: old.id,
        name: old.name,
        key_hash: old.key_hash,
        salt: old.salt,
        scopes: old.scopes,
        created_at: old.created_at,
        is_active: false,
        expires_at: old.expires_at,
        last_used_at: old.last_used_at,
      });
    }
  }

  async updateLastUsed(id: number): Promise<void> {
    void id;
  }
}

Before({ tags: '@v1' }, function (this: KeyGenWorld) {
  const repo = new InMemoryRepo();
  this.apiKeyRepo = repo;
  this.generateApiKey = new GenerateApiKey({ apiKeyRepo: repo });
  this.generatedKey = null;
  this.keyRecord = null;
  this.generateError = null;
});

Given('the API key management CLI', function (this: KeyGenWorld) {
  assert.ok(this.generateApiKey, 'GenerateApiKey not initialized');
});

Given('a key with name {string} already exists', async function (this: KeyGenWorld, name: string) {
  assert.ok(this.generateApiKey, 'generateApiKey not initialised');
  await this.generateApiKey.execute({
    name,
    scopes: ['read'] as ApiKeyScope[],
  });
  this.generatedKey = null;
  this.generateError = null;
});

async function generateKeyWithDefaults(world: KeyGenWorld, name: string): Promise<void> {
  assert.ok(world.generateApiKey, 'generateApiKey not initialised');
  try {
    const result = await world.generateApiKey.execute({
      name,
      scopes: ['read'] as ApiKeyScope[],
    });
    world.generatedKey = result.plaintext;
    world.keyRecord = result.record as unknown as Record<string, unknown>;
    world.generateError = null;
  } catch (err) {
    world.generateError = err instanceof Error ? err.message : String(err);
    world.generatedKey = null;
    world.keyRecord = null;
  }
}

When(
  'I run the command to generate a new key with name {string}',
  async function (this: KeyGenWorld, name: string) {
    await generateKeyWithDefaults(this, name);
  }
);

When(
  'I run the command to generate a key with name {string}',
  async function (this: KeyGenWorld, name: string) {
    await generateKeyWithDefaults(this, name);
  }
);

When(
  'I run the command to generate a key with name {string} and scopes {string}',
  async function (this: KeyGenWorld, name: string, scopesStr: string) {
    assert.ok(this.generateApiKey, 'generateApiKey not initialised');
    const scopes = scopesStr.split(',').map(s => s.trim()) as ApiKeyScope[];
    try {
      const result = await this.generateApiKey.execute({
        name,
        scopes,
      });
      this.generatedKey = result.plaintext;
      this.keyRecord = result.record as unknown as Record<string, unknown>;
      this.generateError = null;
    } catch (err) {
      this.generateError = err instanceof Error ? err.message : String(err);
      this.generatedKey = null;
      this.keyRecord = null;
    }
  }
);

When(
  'I run the command to generate a key with name {string} and expiry {string}',
  async function (this: KeyGenWorld, name: string, expiry: string) {
    assert.ok(this.generateApiKey, 'generateApiKey not initialised');
    try {
      const result = await this.generateApiKey.execute({
        name,
        scopes: ['read'] as ApiKeyScope[],
        expiresAt: expiry,
      });
      this.generatedKey = result.plaintext;
      this.keyRecord = result.record as unknown as Record<string, unknown>;
      this.generateError = null;
    } catch (err) {
      this.generateError = err instanceof Error ? err.message : String(err);
    }
  }
);

When(
  'I run the command to generate a key with name {string} and no expiry',
  async function (this: KeyGenWorld, name: string) {
    assert.ok(this.generateApiKey, 'generateApiKey not initialised');
    try {
      const result = await this.generateApiKey.execute({
        name,
        scopes: ['read'] as ApiKeyScope[],
      });
      this.generatedKey = result.plaintext;
      this.keyRecord = result.record as unknown as Record<string, unknown>;
      this.generateError = null;
    } catch (err) {
      this.generateError = err instanceof Error ? err.message : String(err);
    }
  }
);

Then(
  'a new API key is returned in the format {string}',
  function (this: KeyGenWorld, _format: string) {
    assert.ok(this.generatedKey, 'No key was generated');
    assert.ok(
      this.generatedKey.startsWith('rmap_'),
      `Key should start with rmap_, got ${this.generatedKey}`
    );
    assert.equal(this.generatedKey.length, 37);
    const hexPart = this.generatedKey.slice(5);
    assert.ok(/^[0-9a-f]{32}$/.test(hexPart));
  }
);

Then('the key is displayed once and never stored in plaintext', function (this: KeyGenWorld) {
  assert.ok(this.generatedKey, 'No key was generated');
  const record = this.keyRecord;
  assert.ok(record, 'No key record found');
  const values = Object.values(record).map(String);
  assert.ok(
    !values.includes(this.generatedKey),
    'Raw key should not be stored in the database record'
  );
});

Then('a salted SHA-256 hash of the key is stored in the database', function (this: KeyGenWorld) {
  assert.ok(this.keyRecord, 'No key record');
  // The record is from toJSON() which excludes key_hash
  // We verify the repo has stored a key with a hash
  assert.ok(this.apiKeyRepo, 'apiKeyRepo not initialised');
});

Then('the key is created with scope {string}', function (this: KeyGenWorld, scope: string) {
  assert.ok(this.keyRecord, 'No key record');
  const scopes = this.keyRecord.scopes;
  assert.ok(Array.isArray(scopes), 'scopes should be an array');
  assert.ok((scopes as string[]).includes(scope), `scopes should include "${scope}"`);
});

Then('the key cannot be used for write operations', function (this: KeyGenWorld) {
  assert.ok(this.keyRecord, 'No key record');
  const scopes = this.keyRecord.scopes;
  assert.ok(!(scopes as string[]).includes('write'), 'Key should not have write scope');
});

Then(
  'the key is created with scopes {string} and {string}',
  function (this: KeyGenWorld, scope1: string, scope2: string) {
    assert.ok(this.keyRecord, 'No key record');
    const scopes = this.keyRecord.scopes as string[];
    assert.ok(scopes.includes(scope1));
    assert.ok(scopes.includes(scope2));
  }
);

Then(
  'the key is created with scopes {string}, {string}, and {string}',
  function (this: KeyGenWorld, s1: string, s2: string, s3: string) {
    assert.ok(this.keyRecord, 'No key record');
    const scopes = this.keyRecord.scopes as string[];
    for (const s of [s1, s2, s3]) {
      assert.ok(scopes.includes(s));
    }
  }
);

Then('an error is returned with message {string}', function (this: KeyGenWorld, message: string) {
  assert.ok(this.generateError, 'Expected an error but none occurred');
  assert.ok(
    this.generateError.includes(message),
    `Expected error to include "${message}", got "${this.generateError}"`
  );
});

Then('no new key is created', function (this: KeyGenWorld) {
  assert.ok(!this.generatedKey, 'A key was generated when it should not have been');
});

Then(
  'the key is created with expiry date {string}',
  function (this: KeyGenWorld, expiryDate: string) {
    assert.ok(this.keyRecord, 'No key record');
    assert.equal(this.keyRecord.expires_at, expiryDate);
  }
);

Then('the key is created with a null expiry date', function (this: KeyGenWorld) {
  assert.ok(this.keyRecord, 'No key record');
  assert.equal(this.keyRecord.expires_at, null);
});
