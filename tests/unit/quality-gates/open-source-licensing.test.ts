import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

// Well-known SPDX identifiers matched against LICENSE file text
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

function detectSpdxId(content: string): string | null {
  for (const { id, pattern } of SPDX_PATTERNS) {
    if (pattern.test(content)) return id;
  }
  return null;
}

describe('Open-source licensing', () => {
  describe('LICENSE file', () => {
    it('should exist in the repository root', () => {
      const licensePath = join(ROOT, 'LICENSE');
      expect(existsSync(licensePath)).toBe(true);
    });

    it('should contain a recognised open-source license', () => {
      const content = readFile('LICENSE');
      const spdxId = detectSpdxId(content);
      expect(spdxId).toBeTruthy();
    });

    it('should be at least 10 lines long', () => {
      const content = readFile('LICENSE');
      const lines = content.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(10);
    });

    it('should include a copyright notice', () => {
      const content = readFile('LICENSE');
      expect(content).toMatch(/Copyright/);
    });
  });

  describe('package.json license field', () => {
    const pkg = JSON.parse(readFile('package.json'));

    it('should declare a license field', () => {
      expect(pkg.license).toBeDefined();
      expect(String(pkg.license).trim().length).toBeGreaterThan(0);
    });

    it('should match the SPDX identifier in the LICENSE file', () => {
      const licenseContent = readFile('LICENSE');
      const detectedId = detectSpdxId(licenseContent);
      expect(detectedId).toBeTruthy();
      expect(pkg.license).toBe(detectedId);
    });
  });
});
