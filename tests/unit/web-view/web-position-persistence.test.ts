import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readWebView(): string {
  return readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');
}

describe('Web Position Persistence — Race Condition Fix', () => {
  it('should NOT have a standalone layoutstop handler that calls cy.fit()', () => {
    const html = readWebView();
    // The buggy code has: cy.on('layoutstop', function() { cy.fit(); });
    // This fires BEFORE async positions are loaded, overwriting saved positions.
    // The fix should remove this standalone handler.
    const hasBuggyLayoutstop =
      /cy\.on\(\s*['"]layoutstop['"]\s*,\s*function\s*\(\s*\)\s*\{[^}]*cy\.fit\(\)/s.test(html);
    expect(hasBuggyLayoutstop).toBe(false);
  });

  it('should load positions before creating the cytoscape layout', () => {
    const html = readWebView();
    // The fix must load positions BEFORE the dagre layout runs,
    // not after via an async .then() chain.
    // Positions should be fetched and awaited before cytoscape() is called,
    // OR applied in the layoutstop callback.
    //
    // The buggy pattern: cytoscape({...layout: dagre}); loadComponentPositions().then(...)
    // The fix: await loadComponentPositions() BEFORE cytoscape(), or use layout stop callback
    const cyCreateIdx = html.indexOf('cy = cytoscape(');
    const asyncLoadAfterIdx = html.indexOf('loadComponentPositions().then(', cyCreateIdx);
    // If there's a .then() load AFTER cy creation, the bug is still present
    expect(asyncLoadAfterIdx).toBe(-1);
  });

  it('should await positions before cytoscape init or apply in layoutstop', () => {
    const html = readWebView();
    // The fix: positions must be fetched BEFORE cytoscape() is called
    // (via await in an async renderProgressionTree), so that the dagre layout
    // can be followed by synchronous position application.
    //
    // Evidence: "await loadComponentPositions" appears BEFORE "cy = cytoscape("
    const awaitLoadIdx = html.indexOf('await loadComponentPositions');
    const cyCreateIdx = html.indexOf('cy = cytoscape(');
    expect(awaitLoadIdx).toBeGreaterThanOrEqual(0);
    expect(cyCreateIdx).toBeGreaterThanOrEqual(0);
    expect(awaitLoadIdx).toBeLessThan(cyCreateIdx);
  });

  it('should apply positions inside the layoutstop callback then fit', () => {
    const html = readWebView();
    // The fix should have a layoutstop handler that:
    //   1. applies saved positions to nodes
    //   2. then calls cy.fit()
    // This ensures fit() runs AFTER positions are final.
    //
    // Pattern: cy.once('layoutstop', ...) containing both position application and fit
    const layoutStopBlock =
      /cy\.once\(\s*['"]layoutstop['"][\s\S]*?position[\s\S]*?cy\.fit\(\)/s.test(html);
    expect(layoutStopBlock).toBe(true);
  });

  it('should NOT have a detached async .then position loader', () => {
    const html = readWebView();
    // The buggy code calls loadComponentPositions().then(...) AFTER
    // cytoscape() was created. This is a fire-and-forget async call
    // that races with layoutstop. The fix must not use .then() pattern.
    const hasDetachedThen = /loadComponentPositions\(\)\.then\(/.test(html);
    expect(hasDetachedThen).toBe(false);
  });

  it('should NOT have window resize handler that calls cy.fit() unconditionally', () => {
    const html = readWebView();
    // The buggy code: window.addEventListener('resize', function() { if (cy) cy.fit(); });
    // This resets all positions on ANY window resize, undoing drag work.
    const hasBuggyResize = /window\.addEventListener\(\s*['"]resize['"][\s\S]*?cy\.fit\(\)/s.test(
      html
    );
    expect(hasBuggyResize).toBe(false);
  });
});
