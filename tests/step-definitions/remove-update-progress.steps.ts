import { strict as assert } from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Then } from '@cucumber/cucumber';

// ─── File existence checks in specific directories ──────────────────

Then('no file {string} exists in src\\/use-cases', function (filename: string) {
  const dir = join(process.cwd(), 'src', 'use-cases');
  if (!existsSync(dir)) {
    return;
  }
  const files = readdirSync(dir);
  assert.ok(!files.includes(filename), `File "${filename}" must not exist in src/use-cases`);
});

Then('no file {string} exists in src\\/adapters\\/cli', function (filename: string) {
  const dir = join(process.cwd(), 'src', 'adapters', 'cli');
  if (!existsSync(dir)) {
    return;
  }
  const files = readdirSync(dir);
  assert.ok(!files.includes(filename), `File "${filename}" must not exist in src/adapters/cli`);
});

Then('no file {string} exists in .opencode\\/commands', function (filename: string) {
  const dir = join(process.cwd(), '.opencode', 'commands');
  if (!existsSync(dir)) {
    return;
  }
  const files = readdirSync(dir);
  assert.ok(!files.includes(filename), `File "${filename}" must not exist in .opencode/commands`);
});

// ─── File content assertions ────────────────────────────────────────

Then('the file {string} does not contain {string}', function (filePath: string, forbidden: string) {
  const fullPath = join(process.cwd(), filePath);
  assert.ok(existsSync(fullPath), `File ${filePath} does not exist`);
  const content = readFileSync(fullPath, 'utf-8');
  assert.ok(!content.includes(forbidden), `File ${filePath} must not contain "${forbidden}"`);
});

Then('the file {string} contains {string}', function (filePath: string, expected: string) {
  const fullPath = join(process.cwd(), filePath);
  assert.ok(existsSync(fullPath), `File ${filePath} does not exist`);
  const content = readFileSync(fullPath, 'utf-8');
  assert.ok(content.includes(expected), `File ${filePath} must contain "${expected}"`);
});
