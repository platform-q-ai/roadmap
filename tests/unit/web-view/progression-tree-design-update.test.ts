import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const html = readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');

describe('Progression tree design update — hexagonal nodes', () => {
  it('should use hexagon shape for cytoscape nodes', () => {
    // The node style should declare shape: 'hexagon'
    expect(html).toMatch(/'shape'\s*:\s*'hexagon'/);
  });

  it('should NOT use roundrectangle shape for cytoscape nodes', () => {
    // roundrectangle should not appear in the node shape style
    expect(html).not.toMatch(/'shape'\s*:\s*'roundrectangle'/);
  });

  it('should have node width of at least 120px for hexagonal display', () => {
    const widthMatch = html.match(/'width'\s*:\s*(\d+)/);
    expect(widthMatch).not.toBeNull();
    const width = parseInt(widthMatch![1], 10);
    expect(width).toBeGreaterThanOrEqual(120);
  });

  it('should have node height of at least 120px for hexagonal display', () => {
    const heightMatch = html.match(/'height'\s*:\s*(\d+)/);
    expect(heightMatch).not.toBeNull();
    const height = parseInt(heightMatch![1], 10);
    expect(height).toBeGreaterThanOrEqual(120);
  });
});

describe('Progression tree design update — zoom removal', () => {
  it('should have userZoomingEnabled set to false', () => {
    expect(html).toMatch(/userZoomingEnabled\s*:\s*false/);
  });

  it('should NOT have userZoomingEnabled set to true', () => {
    expect(html).not.toMatch(/userZoomingEnabled\s*:\s*true/);
  });

  it('should have userPanningEnabled set to false', () => {
    expect(html).toMatch(/userPanningEnabled\s*:\s*false/);
  });

  it('should NOT have userPanningEnabled set to true', () => {
    expect(html).not.toMatch(/userPanningEnabled\s*:\s*true/);
  });
});

describe('Progression tree design update — full-width fit', () => {
  it('should call fit() after layout completes', () => {
    // Either via layoutstop event or direct cy.fit() call
    const hasFit = /once?\(\s*['"]layoutstop['"]/.test(html) || /\.fit\s*\(/.test(html);
    expect(hasFit).toBe(true);
  });

  it('should call fit in the layoutstop handler', () => {
    // fit() is called in layoutstop after positions are applied,
    // rather than in a separate resize handler that would reset positions
    expect(html).toMatch(/layoutstop[\s\S]*?\.fit\s*\(/);
  });
});
