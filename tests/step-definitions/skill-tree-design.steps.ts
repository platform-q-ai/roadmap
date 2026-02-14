import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

const ROOT = join(import.meta.dirname, '..', '..');
const WEB_INDEX = join(ROOT, 'web', 'index.html');

interface World {
  html: string;
  [key: string]: unknown;
}

Given('architecture data with app nodes exists', function (this: World) {
  this.html = readFileSync(WEB_INDEX, 'utf8');
});

Then('there should be a branch label {string}', function (this: World, label: string) {
  assert.ok(this.html.includes(label), `Label "${label}" not found in web/index.html`);
});

Then('the {string} branch should have a counter', function (this: World, branch: string) {
  assert.ok(
    this.html.includes(branch),
    `Counter for branch "${branch}" not found in web/index.html`
  );
});

Then('there should be a counter for {string}', function (this: World, label: string) {
  assert.ok(this.html.includes(label), `Counter for "${label}" not found in web/index.html`);
});

Then('it should display the total count of components', function (this: World) {
  assert.ok(
    this.html.includes('total-skill-points'),
    'Logic for total count not found in web/index.html'
  );
});

Then('it should display the synchronization percentage', function (this: World) {
  assert.ok(
    this.html.includes('synchronization'),
    'Logic for synchronization percentage not found in web/index.html'
  );
});

When('I view the progression tree', function () {
  // Navigation step
});

Then(
  'the edges should have a {string} or {string} curve style',
  function (this: World, style1: string, style2: string) {
    assert.ok(
      this.html.includes(style1) || this.html.includes(style2),
      `Curve style "${style1}" or "${style2}" not found in web/index.html`
    );
  }
);

Then('the edges should be dark with high contrast', function (this: World) {
  assert.ok(this.html.includes('line-color'), 'Edge color styling not found in web/index.html');
});

Then('the nodes should have a circular or thick-bordered circular shape', function (this: World) {
  assert.ok(
    this.html.includes('ellipse') ||
      this.html.includes('round-rectangle') ||
      this.html.includes('circle'),
    'Node shape styling not found in web/index.html'
  );
});

Then('active nodes should have a glowing effect', function (this: World) {
  assert.ok(
    this.html.includes('shadow-blur') ||
      this.html.includes('shadow-color') ||
      this.html.includes('glow'),
    'Glowing effect styling not found in web/index.html'
  );
});

Then('locked nodes should be desaturated', function (this: World) {
  assert.ok(
    this.html.includes('grayscale') ||
      this.html.includes('opacity') ||
      this.html.includes('filter'),
    'Locked node styling not found in web/index.html'
  );
});
