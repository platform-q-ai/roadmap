import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Then } from '@cucumber/cucumber';

const ROOT = join(import.meta.dirname, '..', '..');

function readProjectFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

// ─── .env.example variable listing ───────────────────────────

Then('the {string} file lists the variable {string}', function (filename: string, varName: string) {
  const content = readProjectFile(filename);
  const pattern = new RegExp(`^${varName}\\s*=`, 'm');
  assert.ok(
    pattern.test(content),
    `${filename} should list the variable "${varName}" (as ${varName}=...)`
  );
});

// ─── No real secrets ─────────────────────────────────────────

Then('the {string} file does not contain real secrets', function (filename: string) {
  const content = readProjectFile(filename);
  const secretPatterns = [
    /rmap_[0-9a-f]{32}/i,
    /sk[-_]live[-_]/i,
    /ghp_[A-Za-z0-9]{36}/,
    /Bearer\s+[A-Za-z0-9._-]{20,}/,
  ];
  for (const pattern of secretPatterns) {
    assert.ok(
      !pattern.test(content),
      `${filename} appears to contain a real secret matching ${pattern}`
    );
  }
});

// ─── .gitignore line check ───────────────────────────────────
// NOTE: "the {string} file contains a line matching {string}" is already
// defined in open-source-licensing.steps.ts — reused here, not duplicated.

// ─── Git history check ──────────────────────────────────────

Then('the git history does not contain a committed {string} file', function (filename: string) {
  const result = execSync(`git log --all --diff-filter=A --name-only --format= -- "${filename}"`, {
    cwd: ROOT,
    encoding: 'utf-8',
  }).trim();
  assert.ok(
    result.length === 0,
    `"${filename}" should never have been committed to git history, but found: ${result}`
  );
});
