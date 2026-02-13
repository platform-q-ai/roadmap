import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Then } from '@cucumber/cucumber';

const ROOT = join(import.meta.dirname, '..', '..');

interface World {
  html: string;
  [key: string]: unknown;
}

function readWebView(): string {
  return readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');
}

// ─── Hexagonal node shape ──────────────────────────────────

Then(
  'the cytoscape node shape should be {string} not {string}',
  function (this: World, expected: string, notExpected: string) {
    const html = this.html || readWebView();
    // The Cytoscape style for nodes should set shape to the expected value
    const shapePattern = /'shape'\s*:\s*'([^']+)'/g;
    const matches = [...html.matchAll(shapePattern)];
    const shapes = matches.map(m => m[1]);

    assert.ok(
      shapes.includes(expected),
      `Node shape should be "${expected}", found shapes: [${shapes.join(', ')}]`
    );
    assert.ok(
      !shapes.includes(notExpected),
      `Node shape should NOT be "${notExpected}", but it was found`
    );
  }
);

Then(
  'the cytoscape node width should be at least {int} pixels',
  function (this: World, minWidth: number) {
    const html = this.html || readWebView();
    // Match 'width': <number> in the cytoscape node style
    const widthPattern = /'width'\s*:\s*(\d+)/;
    const match = html.match(widthPattern);
    assert.ok(match, 'Node width should be defined in cytoscape style');
    const width = parseInt(match[1], 10);
    assert.ok(width >= minWidth, `Node width should be at least ${minWidth}px, found ${width}px`);
  }
);

Then(
  'the cytoscape node height should be at least {int} pixels',
  function (this: World, minHeight: number) {
    const html = this.html || readWebView();
    // Match 'height': <number> in the cytoscape node style
    const heightPattern = /'height'\s*:\s*(\d+)/;
    const match = html.match(heightPattern);
    assert.ok(match, 'Node height should be defined in cytoscape style');
    const height = parseInt(match[1], 10);
    assert.ok(
      height >= minHeight,
      `Node height should be at least ${minHeight}px, found ${height}px`
    );
  }
);

// ─── Zoom removal ──────────────────────────────────────────

Then(
  'userZoomingEnabled should be {word} in the cytoscape config',
  function (this: World, expected: string) {
    const html = this.html || readWebView();
    const pattern = /userZoomingEnabled\s*:\s*(true|false)/;
    const match = html.match(pattern);
    assert.ok(match, 'userZoomingEnabled should be present in cytoscape config');
    assert.equal(match[1], expected, `userZoomingEnabled should be ${expected}`);
  }
);

Then(
  'userPanningEnabled should be {word} in the cytoscape config',
  function (this: World, expected: string) {
    const html = this.html || readWebView();
    const pattern = /userPanningEnabled\s*:\s*(true|false)/;
    const match = html.match(pattern);
    assert.ok(match, 'userPanningEnabled should be present in cytoscape config');
    assert.equal(match[1], expected, `userPanningEnabled should be ${expected}`);
  }
);

// ─── Full-width fit ────────────────────────────────────────

Then('the cytoscape instance should call fit after layout completes', function (this: World) {
  const html = this.html || readWebView();
  // After layout completes, cy.fit() should be called
  // Look for a layoutstop event handler or direct cy.fit() call after layout
  const hasFitOnLayout = /on\(\s*['"]layoutstop['"]/.test(html) || /\.fit\s*\(/.test(html);
  assert.ok(
    hasFitOnLayout,
    'Cytoscape should call fit() after layout completes (via layoutstop event or direct call)'
  );
});

Then(
  'there should be a resize listener that calls fit on the cytoscape instance',
  function (this: World) {
    const html = this.html || readWebView();
    // Look for window resize handler that calls cy.fit()
    const hasResizeListener =
      /addEventListener\(\s*['"]resize['"]/.test(html) ||
      /onresize/.test(html) ||
      /window\s*\.\s*onresize/.test(html);
    assert.ok(hasResizeListener, 'There should be a window resize listener');

    // Verify that fit is called somewhere in the context of resize
    const hasFit = /\.fit\s*\(/.test(html);
    assert.ok(hasFit, 'The resize handler should call fit() on the cytoscape instance');
  }
);
