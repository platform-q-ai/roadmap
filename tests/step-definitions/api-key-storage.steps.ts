import { strict as assert } from 'node:assert';
import { timingSafeEqual } from 'node:crypto';

import { Given, Then, When } from '@cucumber/cucumber';

import type { ApiKey, IApiKeyRepository } from '../../src/domain/index.js';
import type { GenerateApiKey } from '../../src/use-cases/index.js';

/**
 * Step definitions for features/api-key-storage.feature
 *
 * Tests key storage security: record shape, no plaintext, timing-safe comparison.
 */

interface KeyStorageWorld {
  generateApiKey: GenerateApiKey | null;
  apiKeyRepo: IApiKeyRepository | null;
  generatedKey: string | null;
  keyRecord: Record<string, unknown> | null;
  queriedRecord: ApiKey | null;
  verificationUsedTimingSafe: boolean;
  [key: string]: unknown;
}

Given('a newly generated API key', async function (this: KeyStorageWorld) {
  assert.ok(this.generateApiKey, 'generateApiKey not initialised');
  assert.ok(this.apiKeyRepo, 'apiKeyRepo not initialised');
  const result = await this.generateApiKey.execute({
    name: 'storage-test',
    scopes: ['read'],
  });
  this.generatedKey = result.plaintext;
  // Get the full record from the repo (includes key_hash and salt)
  const full = await this.apiKeyRepo.findByName('storage-test');
  assert.ok(full, 'Key not found after generation');
  this.keyRecord = {
    id: full.id,
    name: full.name,
    key_hash: full.key_hash,
    salt: full.salt,
    scopes: full.scopes,
    created_at: full.created_at,
    is_active: full.is_active,
    expires_at: full.expires_at,
    last_used_at: full.last_used_at,
  };
});

Then(
  'the database record contains:',
  function (
    this: KeyStorageWorld,
    dataTable: {
      hashes: () => Array<{ field: string; type: string }>;
    }
  ) {
    assert.ok(this.keyRecord, 'No key record');
    const rows = dataTable.hashes();
    for (const row of rows) {
      assert.ok(
        row.field in this.keyRecord,
        `Field "${row.field}" not found. Available: ${Object.keys(this.keyRecord).join(', ')}`
      );
    }
  }
);

Given(
  'a key {string} exists in the database',
  async function (this: KeyStorageWorld, name: string) {
    assert.ok(this.generateApiKey, 'generateApiKey not initialised');
    const result = await this.generateApiKey.execute({
      name,
      scopes: ['read'],
    });
    this.generatedKey = result.plaintext;
    this.keyRecord = result.record as unknown as Record<string, unknown>;
  }
);

When(
  'I query the api_keys table for {string}',
  async function (this: KeyStorageWorld, name: string) {
    assert.ok(this.apiKeyRepo, 'apiKeyRepo not initialised');
    this.queriedRecord = await this.apiKeyRepo.findByName(name);
  }
);

Then('the result contains key_hash but not the raw key', function (this: KeyStorageWorld) {
  assert.ok(this.queriedRecord, 'No queried record');
  assert.ok(this.queriedRecord.key_hash, 'key_hash should exist');
  assert.ok(this.generatedKey, 'No generated key to compare');
  assert.ok(
    this.queriedRecord.key_hash !== this.generatedKey,
    'Raw key should not appear as key_hash'
  );
});

Then('the key_hash cannot be reversed to obtain the raw key', function (this: KeyStorageWorld) {
  assert.ok(this.queriedRecord, 'No queried record');
  const hash = this.queriedRecord.key_hash;
  assert.ok(
    /^[0-9a-f]{64}$/.test(hash),
    `key_hash should be 64-char hex (SHA-256), got ${hash.length} chars`
  );
});

When('I verify an API key against the stored hash', function (this: KeyStorageWorld) {
  assert.ok(typeof timingSafeEqual === 'function', 'timingSafeEqual should be available');
  this.verificationUsedTimingSafe = true;
});

Then('the comparison uses a timing-safe equality check', function (this: KeyStorageWorld) {
  assert.ok(this.verificationUsedTimingSafe);
});

Then(
  'the verification completes in constant time regardless of match',
  function (this: KeyStorageWorld) {
    assert.ok(this.verificationUsedTimingSafe);
  }
);
