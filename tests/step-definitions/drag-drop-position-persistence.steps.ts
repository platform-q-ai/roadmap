import { strict as assert } from 'node:assert';

import { Given, Then, When } from '@cucumber/cucumber';
import { DeleteComponentPosition, SaveComponentPosition } from '@use-cases/index.js';

import { InMemoryComponentPositionRepository } from '../../tests/helpers/in-memory-component-position-repository.js';

/**
 * Models the web-view rendering pipeline to verify the fix for:
 *   Bug: positions loaded async; dagre layout + cy.fit() ran before
 *        positions were applied, so saved positions were overwritten.
 *   Fix: apply positions synchronously after layout, then fit.
 *
 * Pipeline order: dagre-layout → positions-applied → fit-viewport
 */
interface PersistenceWorld {
  positionRepo: InMemoryComponentPositionRepository;
  saveUseCase: SaveComponentPosition;
  deleteUseCase: DeleteComponentPosition;
  renderedPositions: Map<string, { x: number; y: number }>;
  dagrePositions: Map<string, { x: number; y: number }>;
  operationLog: string[];
  [key: string]: unknown;
}

function ensureWorld(world: PersistenceWorld): void {
  if (!world.positionRepo) {
    world.positionRepo = new InMemoryComponentPositionRepository();
    world.saveUseCase = new SaveComponentPosition({
      positionRepo: world.positionRepo,
    });
    world.deleteUseCase = new DeleteComponentPosition({
      positionRepo: world.positionRepo,
    });
  }
  if (!world.renderedPositions) {
    world.renderedPositions = new Map();
  }
  if (!world.dagrePositions) {
    world.dagrePositions = new Map();
  }
  if (!world.operationLog) {
    world.operationLog = [];
  }
}

// ─── Given ───────────────────────────────────────────────────────────

Given('components exist in the position database', function (this: PersistenceWorld) {
  ensureWorld(this);
  this.dagrePositions.set('app1', { x: 100, y: 100 });
  this.dagrePositions.set('app2', { x: 200, y: 100 });
  this.dagrePositions.set('app3', { x: 300, y: 100 });
});

Given(
  'a stored position for {string} at x {float} and y {float}',
  function (this: PersistenceWorld, componentId: string, x: number, y: number) {
    ensureWorld(this);
    this.saveUseCase.execute({ componentId, x, y });
  }
);

Given('no stored position for {string}', function (this: PersistenceWorld, componentId: string) {
  ensureWorld(this);
  this.deleteUseCase.execute({ componentId });
});

// ─── When ────────────────────────────────────────────────────────────

When('the tree renders and applies saved positions', function (this: PersistenceWorld) {
  ensureWorld(this);
  // 1. dagre layout assigns default positions
  this.operationLog.push('dagre-layout');
  for (const [id, pos] of this.dagrePositions) {
    this.renderedPositions.set(id, { ...pos });
  }
  // 2. load + apply saved positions (overrides dagre for saved nodes)
  this.operationLog.push('positions-applied');
  const saved = this.positionRepo.findAll();
  for (const pos of saved) {
    if (this.renderedPositions.has(pos.componentId)) {
      this.renderedPositions.set(pos.componentId, { x: pos.x, y: pos.y });
    }
  }
  // 3. fit viewport AFTER positions are final
  this.operationLog.push('fit-viewport');
});

When(
  'a drag of {string} saves position x {float} and y {float} via use case',
  function (this: PersistenceWorld, componentId: string, x: number, y: number) {
    ensureWorld(this);
    this.saveUseCase.execute({ componentId, x, y });
    this.renderedPositions.set(componentId, { x, y });
  }
);

When('the rendered tree is destroyed and rebuilt', function (this: PersistenceWorld) {
  ensureWorld(this);
  this.renderedPositions.clear();
  this.operationLog = [];
  // Dagre defaults are still available for next render
});

// ─── Then ────────────────────────────────────────────────────────────

Then(
  'the rendered position of {string} should be x {float} and y {float}',
  function (this: PersistenceWorld, componentId: string, x: number, y: number) {
    ensureWorld(this);
    const pos = this.renderedPositions.get(componentId);
    assert.ok(pos, `No rendered position for ${componentId}`);
    assert.strictEqual(pos.x, x, `Expected x=${x}, got x=${pos.x}`);
    assert.strictEqual(pos.y, y, `Expected y=${y}, got y=${pos.y}`);
  }
);

Then(
  '{string} rendered position should differ from its dagre default',
  function (this: PersistenceWorld, componentId: string) {
    ensureWorld(this);
    const rendered = this.renderedPositions.get(componentId);
    const dagre = this.dagrePositions.get(componentId);
    assert.ok(rendered, `No rendered position for ${componentId}`);
    assert.ok(dagre, `No dagre position for ${componentId}`);
    const same = rendered.x === dagre.x && rendered.y === dagre.y;
    assert.ok(!same, `${componentId} should NOT be at dagre default`);
  }
);

Then('the operation log should show layout before apply', function (this: PersistenceWorld) {
  ensureWorld(this);
  const layoutIdx = this.operationLog.indexOf('dagre-layout');
  const applyIdx = this.operationLog.indexOf('positions-applied');
  assert.ok(layoutIdx >= 0, 'dagre-layout not in log');
  assert.ok(applyIdx >= 0, 'positions-applied not in log');
  assert.ok(applyIdx > layoutIdx, 'apply must come after layout');
});

Then('the operation log should show fit after apply', function (this: PersistenceWorld) {
  ensureWorld(this);
  const applyIdx = this.operationLog.indexOf('positions-applied');
  const fitIdx = this.operationLog.indexOf('fit-viewport');
  assert.ok(applyIdx >= 0, 'positions-applied not in log');
  assert.ok(fitIdx >= 0, 'fit-viewport not in log');
  assert.ok(fitIdx > applyIdx, 'fit must come after apply');
});

Then(
  'the repository should have x {float} and y {float} for {string}',
  function (this: PersistenceWorld, x: number, y: number, componentId: string) {
    ensureWorld(this);
    const pos = this.positionRepo.findByComponentId(componentId);
    assert.ok(pos, `No position in repo for ${componentId}`);
    assert.strictEqual(pos.x, x);
    assert.strictEqual(pos.y, y);
  }
);

Then(
  '{string} rendered position should match its dagre default',
  function (this: PersistenceWorld, componentId: string) {
    ensureWorld(this);
    const rendered = this.renderedPositions.get(componentId);
    const dagre = this.dagrePositions.get(componentId);
    assert.ok(rendered, `No rendered position for ${componentId}`);
    assert.ok(dagre, `No dagre position for ${componentId}`);
    assert.strictEqual(rendered.x, dagre.x);
    assert.strictEqual(rendered.y, dagre.y);
  }
);
