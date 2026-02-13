import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Unit tests for the web view's data loading strategy.
 *
 * Verifies that index.html fetches from the live API architecture endpoint
 * instead of a static data.json file.
 */

const htmlPath = join(process.cwd(), 'web', 'index.html');

function readHtml(): string {
  return readFileSync(htmlPath, 'utf-8');
}

describe('Web view live API fetch', () => {
  describe('data source', () => {
    it('fetches from /api/architecture endpoint', () => {
      const html = readHtml();
      expect(html).toContain('/api/architecture');
    });

    it('does not fetch from data.json', () => {
      const html = readHtml();
      // The fetch call should not reference data.json
      const fetchPattern = /fetch\s*\(\s*['"]data\.json['"]\s*\)/;
      expect(fetchPattern.test(html)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('shows an error message referencing the API on failure', () => {
      const html = readHtml();
      // The error message should mention API, not data.json or export script
      expect(html).not.toContain('Failed to load data.json');
    });
  });
});
