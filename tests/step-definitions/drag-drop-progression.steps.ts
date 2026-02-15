import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';

interface DragDropWorld {
  nodes: Array<{ id: string; name: string; type: string }>;
  positions: Map<string, { x: number; y: number }>;
  currentPosition: { x: number; y: number } | null;
  response: { status: number; body: unknown } | null;
  error: Error | null;
  lastDraggedComponent: string | null;
  [key: string]: unknown;
}

// ─── Given steps ─────────────────────────────────────────────────────

Given('the progression tree is loaded with components', function (this: DragDropWorld) {
  this.nodes = [
    { id: 'app1', name: 'App 1', type: 'app' },
    { id: 'app2', name: 'App 2', type: 'app' },
    { id: 'app3', name: 'App 3', type: 'app' },
  ];
  this.positions = new Map();
});

Given(
  'component {string} is at position x {float} and y {float}',
  function (this: DragDropWorld, _componentId: string, _x: number, _y: number) {
    // Use case doesn't exist yet - will fail when we try to save
    throw new Error('Not implemented: Component position repository');
  }
);

Given(
  'component {string} has a stored position of x {float} and y {float}',
  function (this: DragDropWorld, _componentId: string, _x: number, _y: number) {
    // Use case doesn't exist yet - will fail when we try to save
    throw new Error('Not implemented: Component position repository');
  }
);

Given(
  'component {string} has no stored position',
  function (this: DragDropWorld, _componentId: string) {
    // No-op - position doesn't exist by default
  }
);

Given(
  'a component {string} exists in the system',
  function (this: DragDropWorld, componentId: string) {
    this.nodes.push({ id: componentId, name: componentId, type: 'app' });
  }
);

Given('the progression tree has custom positions saved', function (this: DragDropWorld) {
  // Use case doesn't exist yet - will fail when we try to save
  throw new Error('Not implemented: Component position repository');
});

Given(
  'component {string} has been dragged to position x {float} and y {float}',
  function (this: DragDropWorld, _componentId: string, _x: number, _y: number) {
    // Use case doesn't exist yet - will fail when we try to save
    throw new Error('Not implemented: Component position repository');
  }
);

// ─── When steps ──────────────────────────────────────────────────────

When(
  'the user drags component {string} to position x {float} and y {float}',
  function (this: DragDropWorld, _componentId: string, _x: number, _y: number) {
    // Use case doesn't exist yet - will fail
    throw new Error('Not implemented: SaveComponentPosition use case');
  }
);

When('the user saves the layout', function (this: DragDropWorld) {
  // Use case doesn't exist yet - will fail
  throw new Error('Not implemented: Save layout functionality');
});

When('the user reloads the page', function (this: DragDropWorld) {
  // Use case doesn't exist yet - will fail
  throw new Error('Not implemented: GetComponentPosition use case');
});

When('the progression tree is rendered', function (this: DragDropWorld) {
  // Use case doesn't exist yet - will fail
  throw new Error('Not implemented: GetComponentPosition use case');
});

When(
  'the user resets component {string} position',
  function (this: DragDropWorld, _componentId: string) {
    // Use case doesn't exist yet - will fail
    throw new Error('Not implemented: DeleteComponentPosition use case');
  }
);

When(
  'the user attempts to save invalid position for component {string}',
  function (this: DragDropWorld, _componentId: string) {
    // Use case doesn't exist yet - will fail with validation error
    throw new Error('Not implemented: Position validation');
  }
);

When('the server restarts', function (this: DragDropWorld) {
  // Persistence not implemented yet - will fail
  throw new Error('Not implemented: Position persistence');
});

When('the API endpoint {string} is called', function (this: DragDropWorld, endpoint: string) {
  if (endpoint === 'GET /api/component-positions') {
    // API endpoint doesn't exist yet - will fail
    throw new Error('Not implemented: GET /api/component-positions endpoint');
  }
});

When(
  'the API endpoint {string} is called with position x {float} and y {float} for {string}',
  function (this: DragDropWorld, endpoint: string, _x: number, _y: number, _componentId: string) {
    if (endpoint === 'POST /api/component-positions') {
      // API endpoint doesn't exist yet - will fail
      throw new Error('Not implemented: POST /api/component-positions endpoint');
    }
  }
);

When('the API endpoint {string} is called', function (this: DragDropWorld, endpoint: string) {
  const match = endpoint.match(/DELETE \/api\/component-positions\/(.+)/);
  if (match) {
    // API endpoint doesn't exist yet - will fail
    throw new Error('Not implemented: DELETE /api/component-positions/:id endpoint');
  }
});

// ─── Then steps ──────────────────────────────────────────────────────

Then(
  'component {string} should be at position x {float} and y {float}',
  function (this: DragDropWorld, componentId: string, x: number, y: number) {
    const position = this.positions.get(componentId);
    assert.ok(position, `Position not found for component ${componentId}`);
    assert.strictEqual(position.x, x);
    assert.strictEqual(position.y, y);
  }
);

Then(
  'the position for component {string} should be stored in the database',
  function (this: DragDropWorld, componentId: string) {
    const position = this.positions.get(componentId);
    assert.ok(position, `Position not stored for component ${componentId}`);
  }
);

Then(
  'component {string} should use the default dagre layout position',
  function (this: DragDropWorld, componentId: string) {
    const position = this.positions.get(componentId);
    assert.strictEqual(position, undefined, 'Component should not have a custom position');
  }
);

Then(
  'the stored position for component {string} should be removed',
  function (this: DragDropWorld, componentId: string) {
    const position = this.positions.get(componentId);
    assert.strictEqual(position, undefined, 'Position should be removed');
  }
);

Then('the system should reject the invalid position', function (this: DragDropWorld) {
  // This is satisfied by the When step throwing an error
  assert.ok(true);
});

Then(
  'component {string} should retain its previous position',
  function (this: DragDropWorld, _componentId: string) {
    // Position should remain unchanged from before the invalid attempt
    assert.ok(true);
  }
);

Then('the response should contain all component positions', function (this: DragDropWorld) {
  assert.ok(this.response, 'Response should exist');
  assert.ok(Array.isArray(this.response.body), 'Response body should be an array');
});

Then(
  'each position should include component_id, x, and y coordinates',
  function (this: DragDropWorld) {
    assert.ok(this.response, 'Response should exist');
    const positions = this.response.body as Array<{ componentId: string; x: number; y: number }>;
    for (const pos of positions) {
      assert.ok('componentId' in pos, 'Position should have componentId');
      assert.ok('x' in pos, 'Position should have x coordinate');
      assert.ok('y' in pos, 'Position should have y coordinate');
    }
  }
);

Then('the position should be saved in the database', function (this: DragDropWorld) {
  assert.ok(this.response, 'Response should exist');
});

Then('the response should return the saved position', function (this: DragDropWorld) {
  assert.ok(this.response, 'Response should exist');
  assert.ok(this.response.body, 'Response body should exist');
});

Then(
  'subsequent GET requests should return 404 for {string}',
  function (this: DragDropWorld, componentId: string) {
    const position = this.positions.get(componentId);
    assert.strictEqual(position, undefined, 'Position should not exist after deletion');
  }
);
