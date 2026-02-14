import { strict as assert } from 'node:assert';

import { Then } from '@cucumber/cucumber';

import { getHtml, type HtmlWorld } from '../helpers/read-web-view.js';

// ─── Remove Architecture Tab ────────────────────────────────

Then(
  'the HTML should not contain a tab button with text {string}',
  function (this: HtmlWorld, text: string) {
    const html = getHtml(this);
    const pattern = new RegExp(`<button[^>]*class="tab-btn[^"]*"[^>]*>${text}</button>`, 'i');
    assert.ok(!pattern.test(html), `Found tab button with text "${text}" — it should be removed`);
  }
);

Then(
  'the HTML should not contain an element with id {string}',
  function (this: HtmlWorld, id: string) {
    const html = getHtml(this);
    assert.ok(!html.includes(`id="${id}"`), `Found element with id="${id}" — it should be removed`);
  }
);

Then(
  'the HTML should not contain a function named {string} that targets the {string} element',
  function (this: HtmlWorld, fnName: string, elementId: string) {
    const html = getHtml(this);
    const hasArchitectureRender =
      html.includes(`getElementById('${elementId}')`) &&
      new RegExp(`function\\s+${fnName}\\s*\\(`).test(html);
    assert.ok(
      !hasArchitectureRender,
      `Found function "${fnName}" targeting "${elementId}" element — it should be removed`
    );
  }
);

Then(
  'the HTML should not contain a function named {string}',
  function (this: HtmlWorld, fnName: string) {
    const html = getHtml(this);
    const pattern = new RegExp(`function\\s+${fnName}\\s*\\(`);
    assert.ok(!pattern.test(html), `Found function "${fnName}" — it should be removed`);
  }
);

Then(
  'the HTML should not contain a tabs container with class {string}',
  function (this: HtmlWorld, className: string) {
    const html = getHtml(this);
    const pattern = new RegExp(`<div[^>]*class="${className}"[^>]*>`);
    assert.ok(
      !pattern.test(html),
      `Found container with class="${className}" — it should be removed`
    );
  }
);

// ─── Progression Content Visibility ──────────────────────────

Then('the progression container should not require tab activation', function (this: HtmlWorld) {
  const html = getHtml(this);
  // Should not have switchTab('progression') call
  assert.ok(
    !html.includes("switchTab('progression')"),
    'Progression container still requires tab activation via switchTab'
  );
});

Then(
  'the progression container should be in a div with class {string} or have no tab-content wrapper',
  function (this: HtmlWorld, _className: string) {
    const html = getHtml(this);
    // The progression container should either be directly visible
    // (no tab-content wrapper) or always active
    const hasTabWrapper = /id="tab-progression"[^>]*class="tab-content"/.test(html);
    if (hasTabWrapper) {
      // If wrapped in tab-content, it must be always active
      assert.ok(
        /id="tab-progression"[^>]*class="tab-content active"/.test(html),
        'Progression content is wrapped in tab-content but not always active'
      );
    }
    // If no tab-content wrapper, that's also fine (direct rendering)
  }
);

// ─── Rename / Remove Tab Label ───────────────────────────────

Then(
  'the HTML should not contain the text {string} as a standalone tab label',
  function (this: HtmlWorld, text: string) {
    const html = getHtml(this);
    // Should not have a tab button with just "Progression" text
    const pattern = new RegExp(`<button[^>]*class="tab-btn[^"]*"[^>]*>${text}</button>`, 'i');
    assert.ok(!pattern.test(html), `Found standalone tab label "${text}" — tabs should be removed`);
  }
);

Then('the progression tree section should exist without tab switching', function (this: HtmlWorld) {
  const html = getHtml(this);
  // The progression container should exist
  assert.ok(html.includes('progression-container'), 'progression-container should exist');
  // But there should be no switchTab function
  assert.ok(
    !/function\s+switchTab\s*\(/.test(html),
    'switchTab function should not exist — no tab switching needed'
  );
});

// ─── Remove Stats Bar ────────────────────────────────────────

// "the HTML should not contain an element with id {string}" is already defined above
// "the HTML should not contain a function named {string}" is already defined above

// ─── Remove Badges ──────────────────────────────────────────

Then('the HTML should not contain a tags-row div in the header', function (this: HtmlWorld) {
  const html = getHtml(this);
  assert.ok(!html.includes('tags-row'), 'Found tags-row in header — it should be removed');
});

Then(
  'the HTML should not contain a badge div with text {string}',
  function (this: HtmlWorld, text: string) {
    const html = getHtml(this);
    const pattern = new RegExp(`<div[^>]*class="badge"[^>]*>${text}</div>`, 'i');
    assert.ok(!pattern.test(html), `Found badge with text "${text}" — it should be removed`);
  }
);

// ─── Update Version ─────────────────────────────────────────

Then(
  'the header h1 should contain version text {string}',
  function (this: HtmlWorld, version: string) {
    const html = getHtml(this);
    assert.ok(html.includes(version), `Header h1 should contain version text "${version}"`);
  }
);

Then(
  'the header h1 should not contain version text {string}',
  function (this: HtmlWorld, version: string) {
    const html = getHtml(this);
    assert.ok(!html.includes(version), `Header h1 should NOT contain version text "${version}"`);
  }
);
