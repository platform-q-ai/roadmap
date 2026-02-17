import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { parseSeedEntries, seedApiKeys } from '../../src/adapters/api/index.js';
import type { ApiKeyProps, ApiKeyScope, IApiKeyRepository } from '../../src/domain/index.js';
import { ApiKey } from '../../src/domain/index.js';
import { GenerateApiKey, ValidateApiKey } from '../../src/use-cases/index.js';

/**
 * Step definitions for features/api-key-seed-persistence.feature
 *
 * Tests that seedApiKeys supports deterministic pre-set keys via the
 * optional "key" field in API_KEY_SEED entries, so keys survive DB rebuilds.
 */

interface SeedPersistenceWorld {
  seedRepo: InMemorySeedRepo | null;
  generateApiKey: GenerateApiKey | null;
  seedRawEnv: string | null;
  seedLogs: string[];
  seedError: string | null;
  generatedPlaintexts: Map<string, string>;
  firstRunHashes: Map<string, string>;
  parsedEntries: Array<{ name: string; scopes: ApiKeyScope[]; plaintext?: string }> | null;
  [key: string]: unknown;
}

class InMemorySeedRepo implements IApiKeyRepository {
  keys: ApiKey[] = [];
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
      this.keys[idx] = new ApiKey({ ...old, is_active: false });
    }
  }

  async updateLastUsed(_id: number): Promise<void> {
    // no-op
  }
}

// ── Given steps ──────────────────────────────────────────────────

Given('an in-memory API key repository', function (this: SeedPersistenceWorld) {
  this.seedRepo = new InMemorySeedRepo();
  this.generateApiKey = new GenerateApiKey({ apiKeyRepo: this.seedRepo });
  this.seedLogs = [];
  this.seedError = null;
  this.generatedPlaintexts = new Map();
  this.firstRunHashes = new Map();
  this.parsedEntries = null;
});

Given(
  'an API_KEY_SEED entry with name {string} and key {string}',
  function (this: SeedPersistenceWorld, name: string, key: string) {
    this.seedRawEnv = JSON.stringify([{ name, scopes: ['read', 'write', 'admin'], key }]);
  }
);

Given(
  'an API_KEY_SEED entry with name {string} and no explicit key',
  function (this: SeedPersistenceWorld, name: string) {
    this.seedRawEnv = JSON.stringify([{ name, scopes: ['read'] }]);
  }
);

Given('the seed has already run once', async function (this: SeedPersistenceWorld) {
  assert.ok(this.seedRepo, 'seedRepo not initialized');
  assert.ok(this.generateApiKey, 'generateApiKey not initialized');
  assert.ok(this.seedRawEnv, 'seedRawEnv not set');

  const logs: string[] = [];
  await seedApiKeys({
    rawEnv: this.seedRawEnv,
    generate: this.generateApiKey,
    log: (msg: string) => logs.push(msg),
  });

  // Record the hashes from the first run
  for (const key of this.seedRepo.keys) {
    this.firstRunHashes.set(key.name, key.key_hash);
  }
});

Given(
  'an API_KEY_SEED with entries:',
  function (
    this: SeedPersistenceWorld,
    dataTable: { hashes: () => Array<Record<string, string>> }
  ) {
    const rows = dataTable.hashes();
    const entries = rows.map(row => ({
      name: row.name,
      scopes: row.scopes.split(',').map(s => s.trim()),
      ...(row.key ? { key: row.key } : {}),
    }));
    this.seedRawEnv = JSON.stringify(entries);
  }
);

Given(
  'a raw JSON seed string with name {string} and key {string}',
  function (this: SeedPersistenceWorld, name: string, key: string) {
    this.seedRawEnv = JSON.stringify([{ name, scopes: ['read'], key }]);
  }
);

Given(
  'a raw JSON seed string with name {string} and no key',
  function (this: SeedPersistenceWorld, name: string) {
    this.seedRawEnv = JSON.stringify([{ name, scopes: ['read'] }]);
  }
);

// ── When steps ───────────────────────────────────────────────────

When('the seed runs', async function (this: SeedPersistenceWorld) {
  assert.ok(this.seedRepo, 'seedRepo not initialized');
  assert.ok(this.generateApiKey, 'generateApiKey not initialized');

  this.seedLogs = [];
  this.seedError = null;

  try {
    await seedApiKeys({
      rawEnv: this.seedRawEnv ?? undefined,
      generate: this.generateApiKey,
      log: (msg: string) => this.seedLogs.push(msg),
    });
  } catch (err) {
    this.seedError = err instanceof Error ? err.message : String(err);
  }

  // Capture generated plaintexts from logs
  for (const log of this.seedLogs) {
    const match = log.match(/Seeded key "([^"]+)": (rmap_\S+)/);
    if (match) {
      this.generatedPlaintexts.set(match[1], match[2]);
    }
  }
});

When('the seed runs twice with the same config', async function (this: SeedPersistenceWorld) {
  assert.ok(this.seedRepo, 'seedRepo not initialized');
  assert.ok(this.generateApiKey, 'generateApiKey not initialized');
  assert.ok(this.seedRawEnv, 'seedRawEnv not set');

  // First run
  this.seedLogs = [];
  await seedApiKeys({
    rawEnv: this.seedRawEnv,
    generate: this.generateApiKey,
    log: (msg: string) => this.seedLogs.push(msg),
  });

  // Record first-run hash
  for (const key of this.seedRepo.keys) {
    this.firstRunHashes.set(key.name, key.key_hash);
  }

  // Simulate a fresh DB by clearing the repo
  this.seedRepo.keys = [];

  // Second run with same config
  await seedApiKeys({
    rawEnv: this.seedRawEnv,
    generate: this.generateApiKey,
    log: () => undefined,
  });
});

When('the seed runs again', async function (this: SeedPersistenceWorld) {
  assert.ok(this.seedRepo, 'seedRepo not initialized');
  assert.ok(this.generateApiKey, 'generateApiKey not initialized');

  this.seedLogs = [];
  this.seedError = null;

  try {
    await seedApiKeys({
      rawEnv: this.seedRawEnv ?? undefined,
      generate: this.generateApiKey,
      log: (msg: string) => this.seedLogs.push(msg),
    });
  } catch (err) {
    this.seedError = err instanceof Error ? err.message : String(err);
  }
});

When('the seed entries are parsed', function (this: SeedPersistenceWorld) {
  assert.ok(this.seedRawEnv, 'seedRawEnv not set');
  this.parsedEntries = parseSeedEntries(this.seedRawEnv) as Array<{
    name: string;
    scopes: ApiKeyScope[];
    key?: string;
  }>;
});

// ── Then steps ───────────────────────────────────────────────────

Then(
  'the stored key for {string} validates against plaintext {string}',
  async function (this: SeedPersistenceWorld, name: string, plaintext: string) {
    assert.ok(this.seedRepo, 'seedRepo not initialized');
    const validator = new ValidateApiKey({ apiKeyRepo: this.seedRepo });
    const result = await validator.execute(plaintext);
    assert.equal(result.status, 'valid', `Key "${name}" should validate against "${plaintext}"`);
    if (result.status === 'valid') {
      assert.equal(result.key.name, name);
    }
  }
);

Then('a key is stored for {string}', async function (this: SeedPersistenceWorld, name: string) {
  assert.ok(this.seedRepo, 'seedRepo not initialized');
  const key = await this.seedRepo.findByName(name);
  assert.ok(key, `No key found for name "${name}"`);
});

Then(
  'the generated plaintext starts with {string}',
  function (this: SeedPersistenceWorld, prefix: string) {
    // Find the most recently logged plaintext
    const lastLog = this.seedLogs[this.seedLogs.length - 1];
    assert.ok(lastLog, 'No seed log found');
    const match = lastLog.match(/: (rmap_\S+)/);
    assert.ok(match, 'No plaintext found in log');
    assert.ok(match[1].startsWith(prefix), `Expected "${match[1]}" to start with "${prefix}"`);
  }
);

Then(
  'the key hash for {string} is identical both times',
  async function (this: SeedPersistenceWorld, name: string) {
    assert.ok(this.seedRepo, 'seedRepo not initialized');
    const firstHash = this.firstRunHashes.get(name);
    assert.ok(firstHash, `No first-run hash for "${name}"`);

    const current = await this.seedRepo.findByName(name);
    assert.ok(current, `No key found for "${name}"`);
    assert.equal(
      current.key_hash,
      firstHash,
      'Hash should be identical across runs for deterministic keys'
    );
  }
);

Then('no new key is generated for {string}', function (this: SeedPersistenceWorld, name: string) {
  const wasGenerated = this.seedLogs.some(log => log.includes(`"${name}"`));
  assert.ok(!wasGenerated, `Key "${name}" should not have been re-generated`);
});

Then('the original key hash is unchanged', async function (this: SeedPersistenceWorld) {
  assert.ok(this.seedRepo, 'seedRepo not initialized');
  for (const [name, originalHash] of this.firstRunHashes) {
    const current = await this.seedRepo.findByName(name);
    assert.ok(current, `No key found for "${name}"`);
    assert.equal(current.key_hash, originalHash, `Hash for "${name}" should not have changed`);
  }
});

Then(
  'the seed reports a validation error for {string}',
  function (this: SeedPersistenceWorld, _name: string) {
    assert.ok(this.seedError, 'Expected a seed error but none occurred');
  }
);

Then(
  '{string} validates against {string}',
  async function (this: SeedPersistenceWorld, name: string, plaintext: string) {
    assert.ok(this.seedRepo, 'seedRepo not initialized');
    const validator = new ValidateApiKey({ apiKeyRepo: this.seedRepo });
    const result = await validator.execute(plaintext);
    assert.equal(result.status, 'valid', `Key "${name}" should validate`);
    if (result.status === 'valid') {
      assert.equal(result.key.name, name);
    }
  }
);

Then(
  '{string} has a generated key starting with {string}',
  async function (this: SeedPersistenceWorld, name: string, prefix: string) {
    assert.ok(this.seedRepo, 'seedRepo not initialized');
    const key = await this.seedRepo.findByName(name);
    assert.ok(key, `No key found for "${name}"`);
    // The plaintext was logged
    const logForName = this.seedLogs.find(l => l.includes(`"${name}"`));
    assert.ok(logForName, `No log for "${name}"`);
    const match = logForName.match(/: (rmap_\S+)/);
    assert.ok(match, 'No plaintext in log');
    assert.ok(match[1].startsWith(prefix), `Expected "${match[1]}" to start with "${prefix}"`);
  }
);

Then(
  'the seed log for {string} shows a masked key',
  function (this: SeedPersistenceWorld, name: string) {
    const logForName = this.seedLogs.find(l => l.includes(`"${name}"`));
    assert.ok(logForName, `No log found for "${name}"`);
    // Masked format: rmap_abcdef...567890 (first 6 + ... + last 6 after prefix)
    assert.match(logForName, /rmap_[a-f0-9]{6}\.\.\.[a-f0-9]{6}/, `Log should contain masked key`);
  }
);

Then(
  'the seed log for {string} does not contain the full plaintext {string}',
  function (this: SeedPersistenceWorld, name: string, plaintext: string) {
    const logForName = this.seedLogs.find(l => l.includes(`"${name}"`));
    assert.ok(logForName, `No log found for "${name}"`);
    assert.ok(
      !logForName.includes(plaintext),
      `Log should NOT contain full plaintext "${plaintext}"`
    );
  }
);

// NOTE: "shows the full plaintext" step removed — all keys are now masked
// in log output (see api-key-masking feature).

Then(
  'the parsed entry has name {string} and key {string}',
  function (this: SeedPersistenceWorld, name: string, key: string) {
    assert.ok(this.parsedEntries, 'No parsed entries');
    const entry = this.parsedEntries.find(e => e.name === name);
    assert.ok(entry, `No entry with name "${name}"`);
    assert.equal(entry.plaintext, key, 'key should be mapped to plaintext');
  }
);

Then(
  'the parsed entry has name {string} and no key',
  function (this: SeedPersistenceWorld, name: string) {
    assert.ok(this.parsedEntries, 'No parsed entries');
    const entry = this.parsedEntries.find(e => e.name === name);
    assert.ok(entry, `No entry with name "${name}"`);
    assert.equal(entry.plaintext, undefined);
  }
);
