import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

const ROOT = join(import.meta.dirname, '..', '..');

interface World {
  packageJson: Record<string, unknown>;
  licenseContent: string;
  [key: string]: unknown;
}

// Well-known SPDX identifiers that appear in license file text
const SPDX_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'MIT', pattern: /\bMIT License\b/i },
  { id: 'Apache-2.0', pattern: /\bApache License.*Version 2\.0\b/i },
  { id: 'BSD-2-Clause', pattern: /\bBSD 2-Clause\b/i },
  { id: 'BSD-3-Clause', pattern: /\bBSD 3-Clause\b/i },
  { id: 'ISC', pattern: /\bISC License\b/i },
  { id: 'GPL-3.0', pattern: /\bGNU GENERAL PUBLIC LICENSE.*Version 3\b/i },
  { id: 'GPL-2.0', pattern: /\bGNU GENERAL PUBLIC LICENSE.*Version 2\b/i },
  { id: 'LGPL-3.0', pattern: /\bGNU LESSER GENERAL PUBLIC LICENSE.*Version 3\b/i },
  { id: 'MPL-2.0', pattern: /\bMozilla Public License.*2\.0\b/i },
  { id: 'AGPL-3.0', pattern: /\bGNU AFFERO GENERAL PUBLIC LICENSE.*Version 3\b/i },
  { id: 'Unlicense', pattern: /\bThis is free and unencumbered software\b/i },
];

function readProjectFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

function detectSpdxId(content: string): string | null {
  for (const { id, pattern } of SPDX_PATTERNS) {
    if (pattern.test(content)) return id;
  }
  return null;
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
