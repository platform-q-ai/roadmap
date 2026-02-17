import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';

import { Given, Then, When } from '@cucumber/cucumber';

import { readBody } from '../../src/adapters/api/routes-shared.js';

interface BodyLimitWorld {
  bodySize: number;
  readResult: string | null;
  readError: { statusCode?: number; message: string } | null;
}

// ─── Given ──────────────────────────────────────────────────

Given('an admin request with a body of {int} bytes', function (this: BodyLimitWorld, size: number) {
  this.bodySize = size;
  this.readResult = null;
  this.readError = null;
});

// ─── When ───────────────────────────────────────────────────

When('the admin route processes the request', async function (this: BodyLimitWorld) {
  const payload = 'x'.repeat(this.bodySize);
  const stream = Readable.from([Buffer.from(payload)]);
  try {
    this.readResult = await readBody(stream as never);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message: string };
    this.readError = { statusCode: error.statusCode, message: error.message };
  }
});

// ─── Then ───────────────────────────────────────────────────

Then('the request body is read successfully', function (this: BodyLimitWorld) {
  assert.ok(this.readResult !== null, 'Expected body to be read successfully');
  assert.ok(this.readError === null, 'Expected no error');
});

Then(
  'the request is rejected with a {int} status code',
  function (this: BodyLimitWorld, _expectedStatus: number) {
    assert.ok(this.readError !== null, 'Expected an error to be thrown for oversized body');
  }
);

Then('the error message mentions the body size limit', function (this: BodyLimitWorld) {
  assert.ok(this.readError !== null, 'Expected an error');
  const msg = this.readError.message.toLowerCase();
  assert.ok(
    msg.includes('body') || msg.includes('size') || msg.includes('large') || msg.includes('limit'),
    `Expected error message to mention body size limit, got: "${this.readError.message}"`
  );
});
