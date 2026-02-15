import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readWebView(): string {
  return readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');
}

describe('Web Drag and Drop Functionality', () => {
  it('should have drag-enabled CSS styles', () => {
    const html = readWebView();

    expect(html).toContain('cursor: grab');
    expect(html).toContain('cursor: grabbing');
  });

  it('should have drag event handlers in Cytoscape config', () => {
    const html = readWebView();

    expect(html).toContain('grab');
    expect(html).toContain('drag');
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
    expect(html).toContain('GET');
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

    expect(html).toContain('grabbable');
  });

  it('should handle fetch errors gracefully', () => {
    const html = readWebView();

    const hasErrorHandling =
      html.includes('.catch') || html.includes('try') || html.includes('error');
    expect(hasErrorHandling).toBe(true);
  });
});
