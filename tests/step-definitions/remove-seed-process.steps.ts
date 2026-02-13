import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Given, Then, When } from '@cucumber/cucumber';

interface World {
  rootDir: string;
  packageScripts: Record<string, string>;
  dockerfileContent: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

Given('the project root directory', function (this: World) {
  this.rootDir = ROOT;
});

When('I read the package.json scripts', function (this: World) {
  const raw = readFileSync(join(this.rootDir, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw);
  this.packageScripts = pkg.scripts ?? {};
});

When('I read the Dockerfile', function (this: World) {
  this.dockerfileContent = readFileSync(join(this.rootDir, 'Dockerfile'), 'utf-8');
});

Then(
  'the {string} script should equal {string}',
  function (this: World, name: string, expected: string) {
    assert.strictEqual(
      this.packageScripts[name],
      expected,
      `Expected script "${name}" to equal "${expected}", got "${this.packageScripts[name]}"`
    );
  }
);

Then('there should be no {string} script', function (this: World, name: string) {
  assert.strictEqual(
    this.packageScripts[name],
    undefined,
    `Expected script "${name}" to not exist, but found: "${this.packageScripts[name]}"`
  );
});

Then('the file {string} should not exist', function (this: World, relativePath: string) {
  const fullPath = join(this.rootDir, relativePath);
  assert.ok(!existsSync(fullPath), `Expected "${relativePath}" to not exist, but it does`);
});

Then('the file {string} should exist', function (this: World, relativePath: string) {
  const fullPath = join(this.rootDir, relativePath);
  assert.ok(existsSync(fullPath), `Expected "${relativePath}" to exist, but it does not`);
});

Then('it should not contain {string}', function (this: World, text: string) {
  assert.ok(!this.dockerfileContent.includes(text), `Expected Dockerfile to not contain "${text}"`);
});
