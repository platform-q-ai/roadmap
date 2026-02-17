import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

/**
 * Step definitions for the production-cors-policy feature.
 *
 * Verifies that render.yaml includes ALLOWED_ORIGINS so
 * production CORS is not left as the permissive wildcard default.
 */

const ROOT = join(import.meta.dirname, '..', '..');

interface CorsWorld {
  configContent: string;
  [key: string]: unknown;
}

// ── Given steps ──────────────────────────────────────────────────────

Given('the {string} configuration file', function (this: CorsWorld, filename: string) {
  const filepath = join(ROOT, filename);
  this.configContent = readFileSync(filepath, 'utf-8');
});

// ── Then steps ───────────────────────────────────────────────────────

Then('it contains an environment variable {string}', function (this: CorsWorld, varName: string) {
  assert.ok(
    this.configContent.includes(`key: ${varName}`),
    `Expected configuration to contain environment variable "${varName}"`
  );
});

Then('the value is not empty', function (this: CorsWorld) {
  // Parse the YAML content to find the ALLOWED_ORIGINS value
  const lines = this.configContent.split('\n');
  let foundKey = false;
  for (const line of lines) {
    if (line.includes('key: ALLOWED_ORIGINS')) {
      foundKey = true;
      continue;
    }
    if (foundKey && line.includes('value:')) {
      const value = line
        .split('value:')[1]
        .trim()
        .replace(/^['"]|['"]$/g, '');
      assert.ok(value.length > 0, 'ALLOWED_ORIGINS value must not be empty');
      return;
    }
  }
  assert.fail('Could not find value for ALLOWED_ORIGINS');
});

Then(
  'the {string} value contains {string}',
  function (this: CorsWorld, varName: string, expected: string) {
    const lines = this.configContent.split('\n');
    let foundKey = false;
    for (const line of lines) {
      if (line.includes(`key: ${varName}`)) {
        foundKey = true;
        continue;
      }
      if (foundKey && line.includes('value:')) {
        const value = line
          .split('value:')[1]
          .trim()
          .replace(/^['"]|['"]$/g, '');
        assert.ok(
          value.includes(expected),
          `Expected "${varName}" value to contain "${expected}", got "${value}"`
        );
        return;
      }
    }
    assert.fail(`Could not find value for "${varName}"`);
  }
);
