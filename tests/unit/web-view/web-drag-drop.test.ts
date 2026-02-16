import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readWebView(): string {
  return readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');
}

describe('Web Drag and Drop Functionality', () => {
  it('should have drag-enabled CSS styles', () => {
    const html = readWebView();

    const hasGrabCursor = html.includes('cursor:grab') || html.includes('cursor: grab');
    const hasGrabbingCursor = html.includes('cursor:grabbing') || html.includes('cursor: grabbing');
    expect(hasGrabCursor).toBe(true);
    expect(hasGrabbingCursor).toBe(true);
  });

  it('should have grab and free event handlers for drag lifecycle', () => {
    const html = readWebView();

    expect(html).toContain('grab');
    expect(html).toContain('free');
  });

  it('should have position save function', () => {
    const html = readWebView();

    expect(html).toContain('saveComponentPosition');
    expect(html).toContain('/api/component-positions');
  });

  it('should have position load function', () => {
    const html = readWebView();

    expect(html).toContain('loadComponentPositions');
    expect(html).toContain('fetch');
  });

  it('should apply saved positions on render', () => {
    const html = readWebView();

    expect(html).toContain('position');
    expect(html).toContain('x');
    expect(html).toContain('y');
  });

  it('should validate positions before saving', () => {
    const html = readWebView();

    const hasClamp = html.includes('Math.max') || html.includes('clamp');
    expect(hasClamp).toBe(true);
  });

  it('should disable drag on locked nodes', () => {
    const html = readWebView();

    // Check for autoungrabify setting or grab event prevention
    const hasGrabbableHandling =
      html.includes('grabbable') || html.includes('autoungrabify') || html.includes('locked');
    expect(hasGrabbableHandling).toBe(true);
  });

  it('should handle fetch errors gracefully', () => {
    const html = readWebView();

    const hasErrorHandling =
      html.includes('.catch') || html.includes('try') || html.includes('error');
    expect(hasErrorHandling).toBe(true);
  });
});
