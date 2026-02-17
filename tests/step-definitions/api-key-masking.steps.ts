import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

import { seedApiKeys } from '../../src/adapters/api/index.js';
import { ValidationError } from '../../src/use-cases/index.js';

interface MaskingWorld {
  seedEntry: { name: string; scopes: string[]; key?: string };
  generatedKey: string;
  logMessages: string[];
}

// ─── Given ──────────────────────────────────────────────────

Given('a seed entry with a deterministic key {string}', function (this: MaskingWorld, key: string) {
  this.seedEntry = { name: 'det-test', scopes: ['read'], key };
  this.generatedKey = key;
  this.logMessages = [];
});

Given('a seed entry without an explicit key', function (this: MaskingWorld) {
  this.seedEntry = { name: 'rnd-test', scopes: ['read'] };
  this.logMessages = [];
});

// ─── When ───────────────────────────────────────────────────

When('the key is seeded successfully', async function (this: MaskingWorld) {
  const plaintext = this.generatedKey;
  const generate = {
    execute: async () => ({ plaintext }),
  };
  const log = (msg: string) => {
    this.logMessages.push(msg);
  };
  const rawEnv = JSON.stringify([this.seedEntry]);
  await seedApiKeys({ rawEnv, generate, log });
});

When(
  'the key is seeded and the generated key is {string}',
  async function (this: MaskingWorld, genKey: string) {
    this.generatedKey = genKey;
    const generate = {
      execute: async () => ({ plaintext: genKey }),
    };
    const log = (msg: string) => {
      this.logMessages.push(msg);
    };
    const rawEnv = JSON.stringify([this.seedEntry]);
    await seedApiKeys({ rawEnv, generate, log });
  }
);

// ─── Then ───────────────────────────────────────────────────

Then('the log output contains a masked form of the key', function (this: MaskingWorld) {
  assert.ok(this.logMessages.length > 0, 'Expected at least one log message');
  const msg = this.logMessages[0];
  const hasMask = msg.includes('...') || msg.includes('******');
  assert.ok(hasMask, `Log message should contain a masked key, got: ${msg}`);
});

Then('the log output does not contain the full plaintext key', function (this: MaskingWorld) {
  const msg = this.logMessages[0];
  assert.ok(
    !msg.includes(this.generatedKey),
    `Log message should NOT contain the full plaintext key "${this.generatedKey}"`
  );
});

Then('the log output contains {string}', function (this: MaskingWorld, expected: string) {
  const msg = this.logMessages[0];
  assert.ok(msg.includes(expected), `Expected log to contain "${expected}", got: ${msg}`);
});

Then(
  'the log output does not contain {string} in the clear',
  function (this: MaskingWorld, forbidden: string) {
    const msg = this.logMessages[0];
    assert.ok(
      !msg.includes(forbidden),
      `Log message should NOT contain "${forbidden}" in the clear`
    );
  }
);
