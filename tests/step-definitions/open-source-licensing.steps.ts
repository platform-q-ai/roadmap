import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

import { detectSpdxId, SPDX_PATTERNS } from '../helpers/spdx-detection.js';

const ROOT = join(import.meta.dirname, '..', '..');

interface World {
  packageJson: Record<string, unknown>;
  licenseContent: string;
  [key: string]: unknown;
}

function readProjectFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

// ─── Given ────────────────────────────────────────────────

Given('the {string} file in the project root', function (this: World, filename: string) {
  this.licenseContent = readProjectFile(filename);
});

// ─── LICENSE file assertions ──────────────────────────────

Then(
  'the {string} file contains a valid SPDX license identifier',
  function (this: World, filename: string) {
    const content = readProjectFile(filename);
    const spdxId = detectSpdxId(content);
    assert.ok(
      spdxId,
      `${filename} does not contain a recognised open-source license. Expected one of: ${SPDX_PATTERNS.map(p => p.id).join(', ')}`
    );
  }
);

Then(
  'the license text is non-empty and at least {int} lines long',
  function (this: World, minLines: number) {
    const content = readProjectFile('LICENSE');
    const lines = content.split('\n');
    assert.ok(content.trim().length > 0, 'LICENSE file is empty');
    assert.ok(
      lines.length >= minLines,
      `LICENSE file has ${lines.length} lines, expected at least ${minLines}`
    );
  }
);

Then(
  'the {string} file contains a line matching {string}',
  function (this: World, filename: string, pattern: string) {
    const content = readProjectFile(filename);
    const regex = new RegExp(pattern);
    assert.ok(regex.test(content), `${filename} does not contain a line matching "${pattern}"`);
  }
);

// ─── package.json license field ───────────────────────────

Then('the {string} field is present and non-empty', function (this: World, fieldName: string) {
  const value = this.packageJson[fieldName];
  assert.ok(
    value !== undefined && value !== null && String(value).trim().length > 0,
    `package.json field "${fieldName}" is missing or empty`
  );
});

Then(
  'the {string} field in package.json matches the SPDX identifier in the LICENSE file',
  function (this: World, fieldName: string) {
    const pkgLicense = String(this.packageJson[fieldName] ?? '').trim();
    assert.ok(pkgLicense.length > 0, `package.json "${fieldName}" field is empty`);

    const licenseContent = this.licenseContent;
    assert.ok(licenseContent, 'LICENSE file content was not loaded (missing Given step?)');

    const detectedId = detectSpdxId(licenseContent);
    assert.ok(detectedId, 'Could not detect SPDX identifier from LICENSE file');

    assert.strictEqual(
      pkgLicense,
      detectedId,
      `package.json "${fieldName}" is "${pkgLicense}" but LICENSE file indicates "${detectedId}"`
    );
  }
);
