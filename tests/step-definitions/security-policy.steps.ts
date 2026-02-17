import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Then } from '@cucumber/cucumber';

const ROOT = join(import.meta.dirname, '..', '..');

function readProjectFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

// ─── SECURITY.md assertions ──────────────────────────────

Then(
  'the {string} file contains a section titled {string}',
  function (filename: string, heading: string) {
    const content = readProjectFile(filename);
    const pattern = new RegExp(`^#+\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    assert.ok(pattern.test(content), `${filename} does not contain a section titled "${heading}"`);
  }
);

Then('the section includes a contact method for private disclosure', function () {
  const content = readProjectFile('SECURITY.md');
  const hasEmail = /@/.test(content);
  const hasPrivateAdvisory = /security advisory/i.test(content) || /privately/i.test(content);
  assert.ok(
    hasEmail || hasPrivateAdvisory,
    'SECURITY.md should include a private contact method (email or security advisory link)'
  );
});

Then(
  'the {string} file does not instruct reporters to open a public GitHub issue',
  function (_filename: string) {
    const content = readProjectFile('SECURITY.md').toLowerCase();
    assert.ok(
      !content.includes('open a public issue') && !content.includes('open an issue'),
      'SECURITY.md should NOT instruct reporters to open a public issue'
    );
  }
);

Then(
  'the {string} file contains a response timeframe in business days',
  function (_filename: string) {
    const content = readProjectFile('SECURITY.md');
    assert.ok(
      /\d+\s*(business\s+)?days?/i.test(content),
      'SECURITY.md should specify a response timeframe in days'
    );
  }
);
