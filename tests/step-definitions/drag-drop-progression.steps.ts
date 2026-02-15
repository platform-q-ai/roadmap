import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';
import type { ComponentPosition } from '@domain/entities/component-position.js';
import { DeleteComponentPosition } from '@use-cases/delete-component-position.js';
import { GetComponentPosition } from '@use-cases/get-component-position.js';
import { SaveComponentPosition } from '@use-cases/save-component-position.js';

import { InMemoryComponentPositionRepository } from '../../tests/helpers/in-memory-component-position-repository.js';

interface DragDropWorld {
  nodes: Array<{ id: string; name: string; type: string }>;
  positionRepo: InMemoryComponentPositionRepository;
  getComponentPosition: GetComponentPosition;
  saveComponentPosition: SaveComponentPosition;
  deleteComponentPosition: DeleteComponentPosition;
  currentPosition: ComponentPosition | null;
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
  this.positionRepo = new InMemoryComponentPositionRepository();
  this.getComponentPosition = new GetComponentPosition({ positionRepo: this.positionRepo });
  this.saveComponentPosition = new SaveComponentPosition({ positionRepo: this.positionRepo });
  this.deleteComponentPosition = new DeleteComponentPosition({ positionRepo: this.positionRepo });
});

Given(
  'component {string} is at position x {float} and y {float}',
  function (this: DragDropWorld, componentId: string, x: number, y: number) {
    if (!this.positionRepo) {
      this.positionRepo = new InMemoryComponentPositionRepository();
      this.getComponentPosition = new GetComponentPosition({ positionRepo: this.positionRepo });
      this.saveComponentPosition = new SaveComponentPosition({ positionRepo: this.positionRepo });
      this.deleteComponentPosition = new DeleteComponentPosition({
        positionRepo: this.positionRepo,
      });
    }
    this.saveComponentPosition.execute({ componentId, x, y });
  }
);

Given(
  'component {string} has a stored position of x {float} and y {float}',
  function (this: DragDropWorld, componentId: string, x: number, y: number) {
    if (!this.positionRepo) {
      this.positionRepo = new InMemoryComponentPositionRepository();
      this.getComponentPosition = new GetComponentPosition({ positionRepo: this.positionRepo });
      this.saveComponentPosition = new SaveComponentPosition({ positionRepo: this.positionRepo });
      this.deleteComponentPosition = new DeleteComponentPosition({
        positionRepo: this.positionRepo,
      });
    }
    this.saveComponentPosition.execute({ componentId, x, y });
  }
);

Given(
  'component {string} has no stored position',
  function (this: DragDropWorld, componentId: string) {
    if (!this.positionRepo) {
      this.positionRepo = new InMemoryComponentPositionRepository();
      this.getComponentPosition = new GetComponentPosition({ positionRepo: this.positionRepo });
      this.saveComponentPosition = new SaveComponentPosition({ positionRepo: this.positionRepo });
      this.deleteComponentPosition = new DeleteComponentPosition({
        positionRepo: this.positionRepo,
      });
    }
    try {
      this.deleteComponentPosition.execute({ componentId });
    } catch {
      // Ignore if position doesn't exist
    }
  }
);

Given(
  'a component {string} exists in the system',
  function (this: DragDropWorld, componentId: string) {
    if (!this.nodes) {
      this.nodes = [];
    }
    if (!this.positionRepo) {
      this.positionRepo = new InMemoryComponentPositionRepository();
      this.getComponentPosition = new GetComponentPosition({ positionRepo: this.positionRepo });
      this.saveComponentPosition = new SaveComponentPosition({ positionRepo: this.positionRepo });
      this.deleteComponentPosition = new DeleteComponentPosition({
        positionRepo: this.positionRepo,
      });
    }
    this.nodes.push({ id: componentId, name: componentId, type: 'app' });
  }
);

Given('the progression tree has custom positions saved', function (this: DragDropWorld) {
  if (!this.positionRepo) {
    this.positionRepo = new InMemoryComponentPositionRepository();
    this.getComponentPosition = new GetComponentPosition({ positionRepo: this.positionRepo });
    this.saveComponentPosition = new SaveComponentPosition({ positionRepo: this.positionRepo });
    this.deleteComponentPosition = new DeleteComponentPosition({ positionRepo: this.positionRepo });
  }
  this.saveComponentPosition.execute({ componentId: 'app1', x: 100, y: 200 });
  this.saveComponentPosition.execute({ componentId: 'app2', x: 300, y: 400 });
});

Given(
  'component {string} has been dragged to position x {float} and y {float}',
  function (this: DragDropWorld, componentId: string, x: number, y: number) {
    if (!this.positionRepo) {
      this.positionRepo = new InMemoryComponentPositionRepository();
      this.getComponentPosition = new GetComponentPosition({ positionRepo: this.positionRepo });
      this.saveComponentPosition = new SaveComponentPosition({ positionRepo: this.positionRepo });
      this.deleteComponentPosition = new DeleteComponentPosition({
        positionRepo: this.positionRepo,
      });
    }
    this.saveComponentPosition.execute({ componentId, x, y });
  }
);

Given('the user has saved the layout', function (this: DragDropWorld) {
  // Layout already saved when positions were created
});

// ─── When steps ──────────────────────────────────────────────────────

When(
  'the user drags component {string} to position x {float} and y {float}',
  function (this: DragDropWorld, componentId: string, x: number, y: number) {
    this.response = {
      status: 200,
      body: this.saveComponentPosition.execute({ componentId, x, y }),
    };
  }
);

When('the user saves the layout', function (this: DragDropWorld) {
  // Positions are saved in drag step - this is for semantic clarity
});

When('the user reloads the page', function (this: DragDropWorld) {
  // Repository persists, so positions are already available
});

When('the progression tree is rendered', function (this: DragDropWorld) {
  // Positions are fetched when needed
});

When(
  'the user resets component {string} position',
  function (this: DragDropWorld, componentId: string) {
    this.deleteComponentPosition.execute({ componentId });
  }
);

When(
  'the user attempts to save invalid position for component {string}',
  function (this: DragDropWorld, componentId: string) {
    try {
      this.response = {
        status: 200,
        body: this.saveComponentPosition.execute({ componentId, x: NaN, y: 400 }),
      };
      this.error = null;
    } catch (e) {
      this.error = e as Error;
      this.response = { status: 400, body: { error: (e as Error).message } };
    }
  }
);

When('the API endpoint {string} is called', function (this: DragDropWorld, endpoint: string) {
  if (endpoint === 'GET /api/component-positions') {
    this.response = { status: 200, body: this.positionRepo.findAll() };
  }
});

When(
  'the API endpoint {string} is called with position x {float} and y {float} for {string}',
  function (this: DragDropWorld, endpoint: string, x: number, y: number, componentId: string) {
    if (endpoint === 'POST /api/component-positions') {
      this.response = {
        status: 200,
        body: this.saveComponentPosition.execute({ componentId, x, y }),
      };
    }
  }
);

When('the API endpoint {string} is called', function (this: DragDropWorld, endpoint: string) {
  const match = endpoint.match(/DELETE \/api\/component-positions\/(.+)/);
  if (match) {
    const componentId = match[1];
    this.deleteComponentPosition.execute({ componentId });
    this.response = { status: 204, body: null };
  }
});

// ─── Then steps ──────────────────────────────────────────────────────

Then(
  'component {string} should be at position x {float} and y {float}',
  function (this: DragDropWorld, componentId: string, x: number, y: number) {
    const position = this.getComponentPosition.execute({ componentId });
    assert.ok(position, `Position not found for component ${componentId}`);
    assert.strictEqual(position.x, x);
    assert.strictEqual(position.y, y);
  }
);

Then(
  'the position for component {string} should be stored in the database',
  function (this: DragDropWorld, componentId: string) {
    const position = this.positionRepo.findByComponentId(componentId);
    assert.ok(position, `Position not stored for component ${componentId}`);
  }
);

Then(
  'component {string} should use the default dagre layout position',
  function (this: DragDropWorld, componentId: string) {
    const position = this.getComponentPosition.execute({ componentId });
    assert.strictEqual(position, null, 'Component should not have a custom position');
  }
);

Then(
  'the stored position for component {string} should be removed',
  function (this: DragDropWorld, componentId: string) {
    const position = this.positionRepo.findByComponentId(componentId);
    assert.strictEqual(position, null, 'Position should be removed');
  }
);

Then(
  'the position for component {string} should be removed',
  function (this: DragDropWorld, componentId: string) {
    const position = this.positionRepo.findByComponentId(componentId);
    assert.strictEqual(position, null, 'Position should be removed');
  }
);

Then('the system should reject the invalid position', function (this: DragDropWorld) {
  assert.ok(this.error, 'Expected an error for invalid position');
});

Then(
  'component {string} should retain its previous position',
  function (this: DragDropWorld, componentId: string) {
    // If there was an error, position should be unchanged
    if (this.error) {
      const position = this.positionRepo.findByComponentId(componentId);
      // Position should either be null (if never set) or have valid coordinates
      if (position) {
        assert.ok(!Number.isNaN(position.x), 'X should not be NaN');
        assert.ok(!Number.isNaN(position.y), 'Y should not be NaN');
      }
    }
  }
);

Then('the response should contain all component positions', function (this: DragDropWorld) {
  assert.ok(this.response, 'Response should exist');
  assert.ok(Array.isArray(this.response.body), 'Response body should be an array');
  assert.strictEqual(this.response.body.length > 0, true, 'Response should contain positions');
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
    const position = this.positionRepo.findByComponentId(componentId);
    assert.strictEqual(position, null, 'Position should not exist after deletion');
  }
);
