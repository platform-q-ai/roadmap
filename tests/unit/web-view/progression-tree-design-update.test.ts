import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const html = readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');

describe('Progression tree design update — circular skill icons', () => {
  it('should use circle shape for cytoscape nodes', () => {
    // The node style should declare shape: 'circle'
    expect(html).toMatch(/'shape'\s*:\s*'circle'/);
  });

  it('should NOT use hexagon shape for cytoscape nodes anymore', () => {
    // hexagon should no longer be the primary shape
    expect(html).not.toMatch(/'shape'\s*:\s*'hexagon'/);
  });
});

describe('Progression tree design update — navigation controls', () => {
  it('should have userZoomingEnabled set to true', () => {
    expect(html).toMatch(/userZoomingEnabled\s*:\s*true/);
  });

  it('should have userPanningEnabled set to true', () => {
    expect(html).toMatch(/userPanningEnabled\s*:\s*true/);
  });
});

describe('Progression tree design update — full-width fit', () => {
  it('should call fit() after layout completes', () => {
    // Either via layoutstop event or direct cy.fit() call
    const hasFit = /on\(\s*['"]layoutstop['"]/.test(html) || /\.fit\s*\(/.test(html);
    expect(hasFit).toBe(true);
  });

  it('should have a window resize listener', () => {
    expect(html).toMatch(/addEventListener\(\s*['"]resize['"]/);
  });

  it('should call fit on resize', () => {
    // The resize handler should trigger a fit on the cytoscape instance
    expect(html).toMatch(/\.fit\s*\(/);
  });
});
