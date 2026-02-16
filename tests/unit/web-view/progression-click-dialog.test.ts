import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const html = readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');

describe('Progression click dialog — DOM structure', () => {
  it('should have a dialog-overlay element', () => {
    expect(html).toContain('dialog-overlay');
  });

  it('should have the overlay hidden by default', () => {
    expect(html).toMatch(/\.dialog-overlay\s*\{[^}]*display:\s*none/);
  });

  it('should have a dialog-close button', () => {
    expect(html).toMatch(/dialog-close|closeDialog/);
  });

  it('should have a dialog-body container', () => {
    expect(html).toContain('dialog-body');
  });
});

describe('Progression click dialog — click not hover', () => {
  it('should use click/tap event on cytoscape nodes', () => {
    const cyOnPattern = /cy\.on\(\s*['"](\w+)['"]\s*,\s*['"]node['"]/g;
    const matches = [...html.matchAll(cyOnPattern)];
    const eventTypes = matches.map(m => m[1]);
    const hasClick = eventTypes.some(e => e === 'click' || e === 'tap');
    expect(hasClick).toBe(true);
  });

  it('should have mouseover handler on nodes for drag cursor feedback', () => {
    const mouseoverNode = /cy\.on\(\s*['"]mouseover['"]\s*,\s*['"]node['"]/;
    expect(mouseoverNode.test(html)).toBe(true);
  });

  it('should have mouseout handler on nodes for drag cursor feedback', () => {
    const mouseoutNode = /cy\.on\(\s*['"]mouseout['"]\s*,\s*['"]node['"]/;
    expect(mouseoutNode.test(html)).toBe(true);
  });
});

describe('Progression click dialog — dialog content', () => {
  it('should have a function to open the dialog', () => {
    expect(html).toMatch(/function\s+openDialog/);
  });

  it('should have a function to close the dialog', () => {
    expect(html).toMatch(/function\s+closeDialog/);
  });

  it('should render node name in the dialog', () => {
    // The openDialog/renderDialog function should reference node.name or data.name
    expect(html).toContain('dialog');
    expect(html).toMatch(/\.name/);
  });

  it('should render version strip in the dialog', () => {
    expect(html).toContain('dialog');
    expect(html).toContain('version-strip');
  });

  it('should render version content in the dialog', () => {
    expect(html).toContain('dialog');
    expect(html).toContain('version-content');
  });

  it('should render features section in the dialog', () => {
    expect(html).toContain('dialog');
    expect(html).toContain('features-section');
  });

  it('should render progress badge in the dialog', () => {
    expect(html).toContain('dialog');
    expect(html).toContain('progress-badge');
  });
});

describe('Progression click dialog — dismiss behavior', () => {
  it('should close on Escape keydown', () => {
    expect(html).toContain('Escape');
    expect(html).toContain('keydown');
  });

  it('should close when clicking the overlay background', () => {
    // The overlay element onclick should call closeDialog
    expect(html).toMatch(/dialog-overlay[^>]*onclick.*closeDialog|closeDialog[^}]*dialog-overlay/s);
  });
});
