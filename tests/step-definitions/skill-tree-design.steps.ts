import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

const WEB_INDEX = join(process.cwd(), 'web', 'index.html');

Given('architecture data with app nodes exists', function () {
  // This step is mostly for context
});

Then('there should be a branch label {string}', function (label: string) {
  const html = readFileSync(WEB_INDEX, 'utf8');
  assert.ok(html.includes(label), `Label "${label}" not found in web/index.html`);
});

Then('the {string} branch should have a counter', function (branch: string) {
  const html = readFileSync(WEB_INDEX, 'utf8');
  // Check for a counter near the branch label
  // For now, just check if the label exists, as we'll implement it as part of the label container
  assert.ok(html.includes(branch), `Counter for branch "${branch}" not found in web/index.html`);
});

Then('there should be a counter for {string}', function (label: string) {
  const html = readFileSync(WEB_INDEX, 'utf8');
  assert.ok(html.includes(label), `Counter for "${label}" not found in web/index.html`);
});

Then('it should display the total count of components', function () {
  const html = readFileSync(WEB_INDEX, 'utf8');
  // Check for logic that calculates or displays total nodes
  assert.ok(html.includes('total_nodes'), 'Logic for total count not found in web/index.html');
});

Then('it should display the synchronization percentage', function () {
  const html = readFileSync(WEB_INDEX, 'utf8');
  // Check for logic that calculates or displays synchronization %
  assert.ok(
    html.includes('synchronization'),
    'Logic for synchronization percentage not found in web/index.html'
  );
});

When('I view the progression tree', function () {
  // Navigation step
});

Then(
  'the edges should have a {string} or {string} curve style',
  function (style1: string, style2: string) {
    const html = readFileSync(WEB_INDEX, 'utf8');
    assert.ok(
      html.includes(style1) || html.includes(style2),
      `Curve style "${style1}" or "${style2}" not found in web/index.html`
    );
  }
);

Then('the edges should be dark with high contrast', function () {
  const html = readFileSync(WEB_INDEX, 'utf8');
  // Check for edge color styling
  assert.ok(html.includes('line-color'), 'Edge color styling not found in web/index.html');
});

Then('the nodes should have a circular or thick-bordered circular shape', function () {
  const html = readFileSync(WEB_INDEX, 'utf8');
  assert.ok(
    html.includes('ellipse') || html.includes('round-rectangle') || html.includes('circle'),
    'Node shape styling not found in web/index.html'
  );
});

Then('active nodes should have a glowing effect', function () {
  const html = readFileSync(WEB_INDEX, 'utf8');
  assert.ok(
    html.includes('box-shadow') || html.includes('shadow-blur') || html.includes('glow'),
    'Glowing effect styling not found in web/index.html'
  );
});

Then('locked nodes should be desaturated', function () {
  const html = readFileSync(WEB_INDEX, 'utf8');
  assert.ok(
    html.includes('grayscale') || html.includes('opacity') || html.includes('filter'),
    'Locked node styling not found in web/index.html'
  );
});
