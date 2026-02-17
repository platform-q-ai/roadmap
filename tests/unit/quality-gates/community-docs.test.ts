import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

describe('Community documentation', () => {
  describe('CONTRIBUTING.md', () => {
    it('should exist in the repository root', () => {
      expect(existsSync(join(ROOT, 'CONTRIBUTING.md'))).toBe(true);
    });

    it('should contain a Getting Started section', () => {
      const content = readFile('CONTRIBUTING.md');
      expect(content).toMatch(/^#+\s+Getting Started/m);
    });

    it('should contain a Pull Requests section', () => {
      const content = readFile('CONTRIBUTING.md');
      expect(content).toMatch(/^#+\s+Pull Requests/m);
    });
  });

  describe('CODE_OF_CONDUCT.md', () => {
    it('should exist in the repository root', () => {
      expect(existsSync(join(ROOT, 'CODE_OF_CONDUCT.md'))).toBe(true);
    });

    it('should contain an Enforcement section', () => {
      const content = readFile('CODE_OF_CONDUCT.md');
      expect(content).toMatch(/^#+\s+Enforcement/m);
    });
  });
});
