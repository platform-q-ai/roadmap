import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

/**
 * Step definitions for features/api-key-generation.feature
 *
 * These steps test the GenerateApiKey use case directly (no HTTP server).
 * The world object carries: generatedKey, keyRecord, generateError, apiKeyRepo.
 */

interface KeyGenWorld {
  generateApiKey: {
    execute: (input: {
      name: string;
      scopes: string[];
      expiresAt?: string | null;
    }) => Promise<{ rawKey: string; record: Record<string, unknown> }>;
  } | null;
  apiKeyRepo: { findByName: (name: string) => Promise<Record<string, unknown> | null> } | null;
  generatedKey: string | null;
  keyRecord: Record<string, unknown> | null;
  generateError: string | null;
  [key: string]: unknown;
}

Given('the API key management CLI', function (this: KeyGenWorld) {
  // The CLI is represented by a GenerateApiKey use case instance.
  // Phase 5 will wire this up; for now this step just marks intent.
  assert.ok(true, 'API key management CLI is available');
});

Given('a key with name {string} already exists', async function (this: KeyGenWorld, name: string) {
  assert.ok(this.generateApiKey, 'generateApiKey use case not initialised');
  await this.generateApiKey.execute({ name, scopes: ['read'] });
  this.generatedKey = null; // Reset so the next generation attempt is fresh
  this.generateError = null;
});

async function generateKeyWithDefaults(world: KeyGenWorld, name: string): Promise<void> {
  assert.ok(world.generateApiKey, 'generateApiKey use case not initialised');
  try {
    const result = await world.generateApiKey.execute({ name, scopes: ['read'] });
    world.generatedKey = result.rawKey;
    world.keyRecord = result.record;
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
    assert.ok(this.generateApiKey, 'generateApiKey use case not initialised');
    const scopes = scopesStr.split(',').map(s => s.trim());
    try {
      const result = await this.generateApiKey.execute({ name, scopes });
      this.generatedKey = result.rawKey;
      this.keyRecord = result.record;
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
    assert.ok(this.generateApiKey, 'generateApiKey use case not initialised');
    try {
      const result = await this.generateApiKey.execute({
        name,
        scopes: ['read'],
        expiresAt: expiry,
      });
      this.generatedKey = result.rawKey;
      this.keyRecord = result.record;
      this.generateError = null;
    } catch (err) {
      this.generateError = err instanceof Error ? err.message : String(err);
    }
  }
);

When(
  'I run the command to generate a key with name {string} and no expiry',
  async function (this: KeyGenWorld, name: string) {
    assert.ok(this.generateApiKey, 'generateApiKey use case not initialised');
    try {
      const result = await this.generateApiKey.execute({
        name,
        scopes: ['read'],
        expiresAt: null,
      });
      this.generatedKey = result.rawKey;
      this.keyRecord = result.record;
      this.generateError = null;
    } catch (err) {
      this.generateError = err instanceof Error ? err.message : String(err);
    }
  }
);

Then(
  'a new API key is returned in the format {string}',
  function (this: KeyGenWorld, format: string) {
    assert.ok(this.generatedKey, 'No key was generated');
    // Format is "rmap_<32 hex characters>" so total length = 5 + 32 = 37
    assert.ok(
      this.generatedKey.startsWith('rmap_'),
      `Key should start with rmap_, got ${this.generatedKey}`
    );
    assert.equal(
      this.generatedKey.length,
      37,
      `Key should be 37 chars, got ${this.generatedKey.length}`
    );
    const hexPart = this.generatedKey.slice(5);
    assert.ok(/^[0-9a-f]{32}$/.test(hexPart), `Hex part should be 32 hex chars, got ${hexPart}`);
  }
);

Then('the key is displayed once and never stored in plaintext', async function (this: KeyGenWorld) {
  assert.ok(this.generatedKey, 'No key was generated');
  assert.ok(this.apiKeyRepo, 'apiKeyRepo not initialised');
  // Verify the raw key is NOT stored in the database record
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
  assert.ok(this.keyRecord.key_hash, 'key_hash is missing');
  assert.ok(this.keyRecord.salt, 'salt is missing');
  assert.ok(
    typeof this.keyRecord.key_hash === 'string' && this.keyRecord.key_hash.length > 0,
    'key_hash should be a non-empty string'
  );
});

Then('the key is created with scope {string}', function (this: KeyGenWorld, scope: string) {
  assert.ok(this.keyRecord, 'No key record');
  const scopes = JSON.parse(String(this.keyRecord.scopes));
  assert.ok(Array.isArray(scopes), 'scopes should be an array');
  assert.ok(
    scopes.includes(scope),
    `scopes should include "${scope}", got ${JSON.stringify(scopes)}`
  );
});

Then('the key cannot be used for write operations', function (this: KeyGenWorld) {
  assert.ok(this.keyRecord, 'No key record');
  const scopes = JSON.parse(String(this.keyRecord.scopes));
  assert.ok(!scopes.includes('write'), 'Key should not have write scope');
});

Then(
  'the key is created with scopes {string} and {string}',
  function (this: KeyGenWorld, scope1: string, scope2: string) {
    assert.ok(this.keyRecord, 'No key record');
    const scopes = JSON.parse(String(this.keyRecord.scopes));
    assert.ok(scopes.includes(scope1), `scopes should include "${scope1}"`);
    assert.ok(scopes.includes(scope2), `scopes should include "${scope2}"`);
  }
);

Then(
  'the key is created with scopes {string}, {string}, and {string}',
  function (this: KeyGenWorld, s1: string, s2: string, s3: string) {
    assert.ok(this.keyRecord, 'No key record');
    const scopes = JSON.parse(String(this.keyRecord.scopes));
    for (const s of [s1, s2, s3]) {
      assert.ok(scopes.includes(s), `scopes should include "${s}"`);
    }
  }
);

Then('an error is returned with message {string}', function (this: KeyGenWorld, message: string) {
  assert.ok(this.generateError, 'Expected an error but none occurred');
  assert.equal(this.generateError, message);
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
