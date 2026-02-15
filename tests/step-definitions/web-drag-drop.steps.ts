import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

const ROOT = join(import.meta.dirname, '..', '..');

interface WebDragDropWorld {
  html: string;
  apiCalls: Array<{ method: string; url: string; body?: unknown }>;
  dragState: {
    isDragging: boolean;
    currentNode: string | null;
    startPosition: { x: number; y: number } | null;
  };
  [key: string]: unknown;
}

function readWebView(): string {
  return readFileSync(join(ROOT, 'web', 'index.html'), 'utf-8');
}

// ─── Given steps ─────────────────────────────────────────────────────

Given('the web view is loaded with the progression tree', function (this: WebDragDropWorld) {
  this.html = readWebView();
  // Drag functionality doesn't exist yet - will fail
  assert.ok(
    this.html.includes('drag') || this.html.includes('grab'),
    'Drag functionality not implemented in web view'
  );
});

Given('the web view is loaded', function (this: WebDragDropWorld) {
  this.html = readWebView();
});

Given(
  'component {string} is visible in the tree',
  function (this: WebDragDropWorld, componentId: string) {
    this.html = readWebView();
    // Check that component rendering exists
    assert.ok(
      this.html.includes(componentId) || this.html.includes('render'),
      `Component ${componentId} rendering not found`
    );
  }
);

Given(
  'component {string} is at position {float} {float}',
  function (this: WebDragDropWorld, componentId: string, x: number, y: number) {
    // Position persistence not implemented yet - will fail
    throw new Error(`Position persistence not implemented for ${componentId} at (${x}, ${y})`);
  }
);

Given(
  'component {string} has a saved position of {float} {float}',
  function (this: WebDragDropWorld, componentId: string, _x: number, _y: number) {
    // Position loading not implemented yet - will fail
    throw new Error(`Position loading not implemented for ${componentId}`);
  }
);

Given(
  'components {string} and {string} are visible',
  function (this: WebDragDropWorld, _comp1: string, _comp2: string) {
    this.html = readWebView();
    assert.ok(
      this.html.includes('progression') || this.html.includes('tree'),
      'Progression tree not found'
    );
  }
);

Given(
  'the user is currently dragging component {string}',
  function (this: WebDragDropWorld, componentId: string) {
    this.dragState = {
      isDragging: true,
      currentNode: componentId,
      startPosition: { x: 400, y: 300 },
    };
  }
);

// ─── When steps ──────────────────────────────────────────────────────

When(
  'the user drags component {string} from position {float} {float} to {float} {float}',
  function (
    this: WebDragDropWorld,
    componentId: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) {
    // Drag implementation not yet added - will fail
    throw new Error(
      `Drag functionality not implemented: cannot drag ${componentId} from (${fromX}, ${fromY}) to (${toX}, ${toY})`
    );
  }
);

When(
  'the user completes dragging {string} to position {float} {float}',
  function (this: WebDragDropWorld, componentId: string, x: number, y: number) {
    // API save on drag end not implemented - will fail
    throw new Error(`Drag-end save not implemented for ${componentId} at (${x}, ${y})`);
  }
);

When(
  'the user drags component {string} to {float} {float}',
  function (this: WebDragDropWorld, componentId: string, _x: number, _y: number) {
    throw new Error(`Drag to position not implemented for ${componentId}`);
  }
);

When('the page loads the progression tree', function (this: WebDragDropWorld) {
  // Position loading from API not implemented - will fail
  throw new Error('Position loading on page load not implemented');
});

When('the user hovers over a draggable component', function (this: WebDragDropWorld) {
  // Hover cursor change not implemented - will fail
  throw new Error('Hover cursor change not implemented');
});

When('the user starts dragging the component', function (this: WebDragDropWorld) {
  throw new Error('Drag start cursor change not implemented');
});

When('the user attempts to drag another component', function (this: WebDragDropWorld) {
  // Multi-drag prevention not implemented - will fail
  throw new Error('Multi-drag prevention not implemented');
});

// ─── Then steps ──────────────────────────────────────────────────────

Then(
  'component {string} should be at the new position {float} {float}',
  function (this: WebDragDropWorld, componentId: string, x: number, y: number) {
    throw new Error(`Position verification not implemented for ${componentId} at (${x}, ${y})`);
  }
);

Then(
  'a POST request should be sent to {string} with the new coordinates',
  function (this: WebDragDropWorld, url: string) {
    const postCall = this.apiCalls?.find(call => call.method === 'POST' && call.url === url);
    assert.ok(postCall, `Expected POST request to ${url} not found`);
  }
);

Then(
  'the node {string} should render at screen position {float} {float}',
  function (this: WebDragDropWorld, componentId: string, _x: number, _y: number) {
    throw new Error(`Visual position verification not implemented for ${componentId}`);
  }
);

Then('a GET request should be made to {string}', function (this: WebDragDropWorld, url: string) {
  const getCall = this.apiCalls?.find(call => call.method === 'GET' && call.url === url);
  assert.ok(getCall, `Expected GET request to ${url} not found`);
});

Then(
  'component {string} should be positioned at {float} {float}',
  function (this: WebDragDropWorld, componentId: string, x: number, y: number) {
    throw new Error(`Position verification not implemented for ${componentId} at (${x}, ${y})`);
  }
);

Then('the cursor should change to {string}', function (this: WebDragDropWorld, cursor: string) {
  // Cursor style check not implemented - will fail
  throw new Error(`Cursor style ${cursor} not implemented`);
});

Then('the second drag should be ignored', function (this: WebDragDropWorld) {
  throw new Error('Multi-drag prevention verification not implemented');
});

Then('the position should be clamped to valid coordinates', function (this: WebDragDropWorld) {
  throw new Error('Position clamping not implemented');
});

Then('the component should remain within the viewport', function (this: WebDragDropWorld) {
  throw new Error('Viewport boundary check not implemented');
});

Then(
  'both components should be at their respective new positions',
  function (this: WebDragDropWorld) {
    throw new Error('Multiple component position verification not implemented');
  }
);
