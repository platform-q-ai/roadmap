import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectSpdxId } from '../../helpers/spdx-detection.js';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
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
