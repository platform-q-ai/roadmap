import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { Then } from '@cucumber/cucumber';

/**
 * Step definitions for the unified-validation-error feature.
 *
 * Verifies that there is a single ValidationError class in the domain layer,
 * not a duplicate in the use-cases layer.
 */

const ROOT = join(import.meta.dirname, '..', '..');

// ── Then steps ───────────────────────────────────────────────────────

Then('the file {string} exports a class {string}', function (_filePath: string, className: string) {
  const content = readFileSync(join(ROOT, _filePath), 'utf-8');
  const pattern = new RegExp(`export class ${className}\\b`);
  assert.ok(pattern.test(content), `Expected "${_filePath}" to export class "${className}"`);
});

Then(
  'the file {string} does not define a class {string}',
  function (_filePath: string, className: string) {
    const content = readFileSync(join(ROOT, _filePath), 'utf-8');
    const pattern = new RegExp(`export class ${className}\\b`);
    assert.ok(
      !pattern.test(content),
      `Expected "${_filePath}" NOT to define class "${className}", but it does`
    );
  }
);

Then(
  'the file {string} re-exports {string} from the domain layer',
  function (_filePath: string, exportName: string) {
    const content = readFileSync(join(ROOT, _filePath), 'utf-8');
    // It should re-export from domain, not from local ./errors.js
    const domainReExport = content.includes(exportName) && content.includes("'../domain/");
    assert.ok(
      domainReExport,
      `Expected "${_filePath}" to re-export "${exportName}" from domain layer`
    );
  }
);

Then('no use-case file imports ValidationError from {string}', function (importPath: string) {
  const useCasesDir = join(ROOT, 'src', 'use-cases');
  const files = readdirSync(useCasesDir).filter(
    (f: string) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'errors.ts'
  );

  const importPattern = new RegExp(
    `import\\s+\\{[^}]*ValidationError[^}]*\\}\\s+from\\s+'${importPath.replace(/\./g, '\\.')}'`
  );
  const offenders: string[] = [];
  for (const file of files) {
    const content = readFileSync(join(useCasesDir, file), 'utf-8');
    if (importPattern.test(content)) {
      offenders.push(file);
    }
  }

  assert.equal(
    offenders.length,
    0,
    `These use-case files still import ValidationError from "${importPath}": ${offenders.join(', ')}`
  );
});
