import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

const ROOT = join(import.meta.dirname, '..', '..');

interface World {
  html: string;
  [key: string]: unknown;
}

function readWebView(): string {
  return readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');
}

// ─── Given ────────────────────────────────────────────────

Given('the web view HTML', function (this: World) {
  this.html = readWebView();
});

// ─── Dialog structure ─────────────────────────────────────

Then(
  'it should contain a dialog overlay element with class {string}',
  function (this: World, className: string) {
    assert.ok(
      this.html.includes(className),
      `Web view should contain an element with class "${className}"`
    );
  }
);

Then('the dialog overlay should be hidden by default', function (this: World) {
  // The overlay should have display:none or a hidden class by default
  assert.ok(
    this.html.includes('dialog-overlay') &&
      (this.html.includes('display:none') || this.html.includes('display: none')),
    'Dialog overlay should be hidden by default (display:none in CSS or inline)'
  );
});

Then('the dialog should contain a close button', function (this: World) {
  // Look for a close button inside or near the dialog
  assert.ok(
    this.html.includes('dialog-close') || this.html.includes('closeDialog'),
    'Dialog should have a close button or closeDialog function'
  );
});

// ─── Click replaces hover ─────────────────────────────────

Then(
  'the cytoscape node event should use {string} not {string}',
  function (this: World, expected: string, _notExpected: string) {
    // Find the cy.on event registration for node interaction
    // Should use 'click' or 'tap', not 'mouseover'
    const cyOnPattern = /cy\.on\(\s*['"](\w+)['"]\s*,\s*['"]node['"]/g;
    const matches = [...this.html.matchAll(cyOnPattern)];
    const eventTypes = matches.map(m => m[1]);

    const hasExpected = eventTypes.some(
      e => e === expected || (expected === 'click' && e === 'tap')
    );
    assert.ok(
      hasExpected,
      `Cytoscape should use "${expected}" (or "tap") for node events, found: [${eventTypes.join(', ')}]`
    );
  }
);

Then(
  'there should be no {string} handler for showing node details',
  function (this: World, eventName: string) {
    // Ensure no mouseover handler that shows tooltip/dialog content
    const mouseoverNodePattern = /cy\.on\(\s*['"]mouseover['"]\s*,\s*['"]node['"]/;
    assert.ok(
      !mouseoverNodePattern.test(this.html),
      `Should not have a "${eventName}" handler on cytoscape nodes for showing details`
    );
  }
);

// ─── Dialog content ───────────────────────────────────────

Then('the dialog render function should display the node name', function (this: World) {
  // The dialog rendering should reference the node name
  assert.ok(
    this.html.includes('dialog') && this.html.includes('.name'),
    'Dialog render should display node name'
  );
});

Then('the dialog render function should display the node description', function (this: World) {
  assert.ok(
    this.html.includes('dialog') && this.html.includes('.description'),
    'Dialog render should display node description'
  );
});

Then('the dialog render function should include a version strip', function (this: World) {
  // Dialog should render version-strip or version tabs
  assert.ok(
    this.html.includes('dialog') && this.html.includes('version-strip'),
    'Dialog render should include version strip'
  );
});

Then('the version strip should support {string} versions', function (this: World, version: string) {
  // The version rendering code should handle mvp, v1, v2
  assert.ok(
    this.html.includes(`'${version}'`) || this.html.includes(`"${version}"`),
    `Version strip should support "${version}" versions`
  );
});

Then('the dialog render function should include version content display', function (this: World) {
  assert.ok(
    this.html.includes('dialog') && this.html.includes('version-content'),
    'Dialog render should include version content display'
  );
});

Then('the dialog render function should include a features section', function (this: World) {
  assert.ok(
    this.html.includes('dialog') && this.html.includes('features-section'),
    'Dialog render should include features section'
  );
});

Then('the dialog render function should include a progress badge', function (this: World) {
  assert.ok(
    this.html.includes('dialog') && this.html.includes('progress-badge'),
    'Dialog render should include progress badge'
  );
});

// ─── Dialog dismiss behavior ──────────────────────────────

Then(
  'there should be a keydown listener for {string} to close the dialog',
  function (this: World, key: string) {
    assert.ok(
      this.html.includes(key) && this.html.includes('keydown'),
      `Should have a keydown listener for "${key}" to close the dialog`
    );
  }
);

Then('clicking the overlay background should close the dialog', function (this: World) {
  // The overlay element should have an onclick that closes/hides
  assert.ok(
    this.html.includes('dialog-overlay') && this.html.includes('closeDialog'),
    'Clicking the overlay background should trigger closeDialog'
  );
});
