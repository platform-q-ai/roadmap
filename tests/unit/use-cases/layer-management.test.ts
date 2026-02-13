import type { IEdgeRepository, INodeRepository } from '@domain/index.js';
import { Edge, Node } from '@domain/index.js';
import { CreateLayer, GetLayer, ListLayers, MoveComponent } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

// ─── Helpers ────────────────────────────────────────────────────────

function makeNode(id: string, type = 'component', layer: string | null = 'test-layer'): Node {
  return new Node({
    id,
    name: `Node ${id}`,
    type: type as Node['type'],
    layer: type === 'layer' ? undefined : (layer ?? undefined),
  });
}

function makeEdge(id: number, src: string, tgt: string, type = 'CONTAINS'): Edge {
  return new Edge({ id, source_id: src, target_id: tgt, type: type as Edge['type'] });
}

function mockNodeRepo(nodes: Node[]): INodeRepository {
  return {
    findAll: vi.fn(async () => nodes),
    findById: vi.fn(async (id: string) => nodes.find(n => n.id === id) ?? null),
    findByType: vi.fn(async (type: string) => nodes.filter(n => n.type === type)),
    findByLayer: vi.fn(async (layerId: string) => nodes.filter(n => n.layer === layerId)),
    exists: vi.fn(async (id: string) => nodes.some(n => n.id === id)),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockEdgeRepo(edges: Edge[]): IEdgeRepository {
  return {
    findAll: vi.fn(async () => edges),
    findById: vi.fn(),
    findBySource: vi.fn(async (sid: string) => edges.filter(e => e.source_id === sid)),
    findByTarget: vi.fn(async (tid: string) => edges.filter(e => e.target_id === tid)),
    findByType: vi.fn(async (type: string) => edges.filter(e => e.type === type)),
    findRelationships: vi.fn(async () => edges.filter(e => !e.isContainment())),
    existsBySrcTgtType: vi.fn(async (src: string, tgt: string, type: string) =>
      edges.some(e => e.source_id === src && e.target_id === tgt && e.type === type)
    ),
    save: vi.fn(async (edge: Edge) => edge),
    delete: vi.fn(),
  };
}

// ─── ListLayers ─────────────────────────────────────────────────────

describe('ListLayers', () => {
  it('returns only nodes with type "layer"', async () => {
    const nodes = [
      makeNode('layer-1', 'layer'),
      makeNode('layer-2', 'layer'),
      makeNode('comp-1', 'component'),
    ];
    const nodeRepo = mockNodeRepo(nodes);
    const uc = new ListLayers({ nodeRepo });
    const result = await uc.execute();

    expect(result).toHaveLength(2);
    expect(result.every(n => n.type === 'layer')).toBe(true);
  });

  it('returns empty array when no layers exist', async () => {
    const nodeRepo = mockNodeRepo([makeNode('comp-1')]);
    const uc = new ListLayers({ nodeRepo });
    const result = await uc.execute();

    expect(result).toHaveLength(0);
  });
});

// ─── GetLayer ───────────────────────────────────────────────────────

describe('GetLayer', () => {
  it('returns layer with its children', async () => {
    const layer = makeNode('test-layer', 'layer');
    const child1 = makeNode('child-1', 'component', 'test-layer');
    const child2 = makeNode('child-2', 'component', 'test-layer');
    const nodes = [layer, child1, child2];
    const nodeRepo = mockNodeRepo(nodes);
    const uc = new GetLayer({ nodeRepo });
    const result = await uc.execute('test-layer');

    expect(result.layer.id).toBe('test-layer');
    expect(result.children).toHaveLength(2);
    expect(result.children.map(c => c.id)).toContain('child-1');
    expect(result.children.map(c => c.id)).toContain('child-2');
  });

  it('returns empty children when layer has no components', async () => {
    const layer = makeNode('empty-layer', 'layer');
    const nodeRepo = mockNodeRepo([layer]);
    const uc = new GetLayer({ nodeRepo });
    const result = await uc.execute('empty-layer');

    expect(result.layer.id).toBe('empty-layer');
    expect(result.children).toHaveLength(0);
  });

  it('throws NodeNotFoundError for non-existent layer', async () => {
    const nodeRepo = mockNodeRepo([]);
    const uc = new GetLayer({ nodeRepo });

    await expect(uc.execute('ghost')).rejects.toThrow(/not found/i);
  });

  it('throws NodeNotFoundError when node is not a layer', async () => {
    const comp = makeNode('comp-1', 'component');
    const nodeRepo = mockNodeRepo([comp]);
    const uc = new GetLayer({ nodeRepo });

    await expect(uc.execute('comp-1')).rejects.toThrow(/not found/i);
  });
});

// ─── CreateLayer ────────────────────────────────────────────────────

describe('CreateLayer', () => {
  it('creates a layer node', async () => {
    const nodes: Node[] = [];
    const nodeRepo = mockNodeRepo(nodes);
    const uc = new CreateLayer({ nodeRepo });
    const result = await uc.execute({ id: 'new-layer', name: 'New Layer' });

    expect(result.id).toBe('new-layer');
    expect(result.type).toBe('layer');
    expect(result.layer).toBeNull();
    expect(nodeRepo.save).toHaveBeenCalledTimes(1);
  });

  it('creates a layer with optional fields', async () => {
    const nodeRepo = mockNodeRepo([]);
    const uc = new CreateLayer({ nodeRepo });
    const result = await uc.execute({
      id: 'full-layer',
      name: 'Full Layer',
      color: '#E74C3C',
      icon: 'layers',
      description: 'A test layer',
      sort_order: 42,
    });

    expect(result.color).toBe('#E74C3C');
    expect(result.icon).toBe('layers');
    expect(result.description).toBe('A test layer');
    expect(result.sort_order).toBe(42);
  });

  it('throws NodeExistsError for duplicate id', async () => {
    const existing = makeNode('dup-layer', 'layer');
    const nodeRepo = mockNodeRepo([existing]);
    const uc = new CreateLayer({ nodeRepo });

    await expect(uc.execute({ id: 'dup-layer', name: 'Dup' })).rejects.toThrow(/already exists/i);
  });

  it('throws ValidationError when name is empty', async () => {
    const nodeRepo = mockNodeRepo([]);
    const uc = new CreateLayer({ nodeRepo });

    await expect(uc.execute({ id: 'no-name', name: '' })).rejects.toThrow();
  });

  it('throws ValidationError when id is invalid', async () => {
    const nodeRepo = mockNodeRepo([]);
    const uc = new CreateLayer({ nodeRepo });

    await expect(uc.execute({ id: 'Bad Layer!', name: 'Bad' })).rejects.toThrow();
  });
});

// ─── MoveComponent ──────────────────────────────────────────────────

describe('MoveComponent', () => {
  it('moves component to a different layer', async () => {
    const oldLayer = makeNode('old-layer', 'layer');
    const newLayer = makeNode('new-layer', 'layer');
    const comp = makeNode('comp-1', 'component', 'old-layer');
    const nodes = [oldLayer, newLayer, comp];
    const edges = [makeEdge(1, 'old-layer', 'comp-1', 'CONTAINS')];
    const nodeRepo = mockNodeRepo(nodes);
    const edgeRepo = mockEdgeRepo(edges);
    const uc = new MoveComponent({ nodeRepo, edgeRepo });
    const result = await uc.execute('comp-1', 'new-layer');

    expect(result.layer).toBe('new-layer');
    expect(nodeRepo.save).toHaveBeenCalled();
    expect(edgeRepo.delete).toHaveBeenCalledWith(1);
    expect(edgeRepo.save).toHaveBeenCalled();
  });

  it('is a no-op when moving to the same layer', async () => {
    const layer = makeNode('same-layer', 'layer');
    const comp = makeNode('comp-1', 'component', 'same-layer');
    const nodes = [layer, comp];
    const edges = [makeEdge(1, 'same-layer', 'comp-1', 'CONTAINS')];
    const nodeRepo = mockNodeRepo(nodes);
    const edgeRepo = mockEdgeRepo(edges);
    const uc = new MoveComponent({ nodeRepo, edgeRepo });
    const result = await uc.execute('comp-1', 'same-layer');

    expect(result.layer).toBe('same-layer');
    // Should not modify edges for same-layer move
    expect(edgeRepo.delete).not.toHaveBeenCalled();
    expect(edgeRepo.save).not.toHaveBeenCalled();
  });

  it('throws NodeNotFoundError for non-existent component', async () => {
    const nodeRepo = mockNodeRepo([]);
    const edgeRepo = mockEdgeRepo([]);
    const uc = new MoveComponent({ nodeRepo, edgeRepo });

    await expect(uc.execute('ghost', 'some-layer')).rejects.toThrow(/not found/i);
  });

  it('throws ValidationError for non-existent target layer', async () => {
    const layer = makeNode('old-layer', 'layer');
    const comp = makeNode('comp-1', 'component', 'old-layer');
    const nodeRepo = mockNodeRepo([layer, comp]);
    const edgeRepo = mockEdgeRepo([]);
    const uc = new MoveComponent({ nodeRepo, edgeRepo });

    await expect(uc.execute('comp-1', 'ghost-layer')).rejects.toThrow(/layer/i);
  });

  it('throws ValidationError when target is not a layer', async () => {
    const layer = makeNode('old-layer', 'layer');
    const comp = makeNode('comp-1', 'component', 'old-layer');
    const otherComp = makeNode('not-a-layer', 'component', 'old-layer');
    const nodeRepo = mockNodeRepo([layer, comp, otherComp]);
    const edgeRepo = mockEdgeRepo([]);
    const uc = new MoveComponent({ nodeRepo, edgeRepo });

    await expect(uc.execute('comp-1', 'not-a-layer')).rejects.toThrow(/layer/i);
  });
});
