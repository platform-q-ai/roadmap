import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const htmlPath = join(ROOT, 'web', 'index.html');

function readHtml(): string {
  return readFileSync(htmlPath, 'utf-8');
}

describe('Skill Tree Design', () => {
  describe('branch labels and counters', () => {
    it('contains branch labels JAGER, KRIJGER, and ZIENER', () => {
      const html = readHtml();
      expect(html).toContain('JAGER');
      expect(html).toContain('KRIJGER');
      expect(html).toContain('ZIENER');
    });

    it('contains overall points counter label VAARDIGHEIDSPUNTEN', () => {
      const html = readHtml();
      expect(html).toContain('VAARDIGHEIDSPUNTEN');
    });

    it('contains synchronization label SENU\'S PERCEPTIE', () => {
      const html = readHtml();
      expect(html).toContain('SENU\'S PERCEPTIE');
    });
  });

  describe('cytoscape styling', () => {
    it('uses rectilinear edge curve style (taxi or segment)', () => {
      const html = readHtml();
      expect(html).toMatch(/'curve-style':\s*'(taxi|segment)'/);
    });

    it('uses circular node shape (ellipse or circle)', () => {
      const html = readHtml();
      expect(html).toMatch(/'shape':\s*'(ellipse|circle)'/);
    });

    it('implements glowing effect for active nodes', () => {
      const html = readHtml();
      expect(html).toContain('box-shadow');
    });

    it('implements desaturation or opacity for locked nodes', () => {
      const html = readHtml();
      expect(html).toContain('locked');
      expect(html).toMatch(/opacity|filter|grayscale/);
    });
  });
});
