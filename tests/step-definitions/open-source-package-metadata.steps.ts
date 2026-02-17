import { strict as assert } from 'node:assert';

import { Then } from '@cucumber/cucumber';

interface World {
  packageJson: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Repository field ─────────────────────────────────────

Then('the {string} field is present', function (this: World, fieldName: string) {
  const value = this.packageJson[fieldName];
  assert.ok(value !== undefined && value !== null, `package.json field "${fieldName}" is missing`);
});

Then('the {string} field contains a valid GitHub URL', function (this: World, fieldName: string) {
  const value = this.packageJson[fieldName];
  const url =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>).url
      : String(value);
  assert.ok(
    typeof url === 'string' && /github\.com/.test(url),
    `package.json "${fieldName}" should contain a GitHub URL, got: ${JSON.stringify(value)}`
  );
});

// ─── Bugs field ───────────────────────────────────────────

Then(
  'the {string} field contains a URL ending with {string}',
  function (this: World, fieldName: string, suffix: string) {
    const value = this.packageJson[fieldName];
    const url =
      typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>).url
        : String(value);
    assert.ok(
      typeof url === 'string' && url.endsWith(suffix),
      `package.json "${fieldName}" URL should end with "${suffix}", got: ${JSON.stringify(value)}`
    );
  }
);

// ─── Keywords ─────────────────────────────────────────────

Then('the {string} field is a non-empty array', function (this: World, fieldName: string) {
  const value = this.packageJson[fieldName];
  assert.ok(Array.isArray(value), `package.json "${fieldName}" should be an array`);
  assert.ok(
    (value as unknown[]).length > 0,
    `package.json "${fieldName}" array should not be empty`
  );
});

Then(
  'the {string} array contains at least {int} entries',
  function (this: World, fieldName: string, min: number) {
    const value = this.packageJson[fieldName];
    assert.ok(Array.isArray(value), `package.json "${fieldName}" should be an array`);
    assert.ok(
      (value as unknown[]).length >= min,
      `package.json "${fieldName}" has ${(value as unknown[]).length} entries, expected at least ${min}`
    );
  }
);

// ─── Private field ────────────────────────────────────────

Then('the {string} field is true', function (this: World, fieldName: string) {
  assert.strictEqual(
    this.packageJson[fieldName],
    true,
    `package.json "${fieldName}" should be true, got: ${JSON.stringify(this.packageJson[fieldName])}`
  );
});
