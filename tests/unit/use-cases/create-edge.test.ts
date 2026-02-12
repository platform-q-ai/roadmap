import type { IEdgeRepository, INodeRepository } from '@domain/index.js';
import { Edge } from '@domain/index.js';
import { CreateEdge } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(opts: { nodeIds?: string[]; existingEdges?: Edge[] } = {}) {
  const savedEdges: Edge[] = [];
  const existingEdges = opts.existingEdges ?? [];
  const nodeIds = new Set(opts.nodeIds ?? []);

  const nodeRepo: INodeRepository = {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByType: vi.fn(),
    findByLayer: vi.fn(),
    exists: vi.fn().mockImplementation(async (id: string) => nodeIds.has(id)),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn(),
    findById: vi.fn().mockImplementation(async (id: number) => {
      return existingEdges.find(e => e.id === id) ?? savedEdges.find(e => e.id === id) ?? null;
    }),
    findBySource: vi.fn(),
    findByTarget: vi.fn(),
    findByType: vi.fn(),
    findRelationships: vi.fn(),
    existsBySrcTgtType: vi
      .fn()
      .mockImplementation(async (src: string, tgt: string, type: string) =>
        existingEdges.some(e => e.source_id === src && e.target_id === tgt && e.type === type)
      ),
    save: vi.fn().mockImplementation(async (edge: Edge) => {
      const withId = new Edge({
        id: edge.id ?? savedEdges.length + 1,
        source_id: edge.source_id,
        target_id: edge.target_id,
        type: edge.type,
        label: edge.label,
        metadata: edge.metadata,
      });
      savedEdges.push(withId);
      return withId;
    }),
    delete: vi.fn(),
  };

  return { nodeRepo, edgeRepo, savedEdges };
}

describe('CreateEdge', () => {
  it('creates an edge between two existing components', async () => {
    const { nodeRepo, edgeRepo, savedEdges } = createMockRepos({
      nodeIds: ['src-a', 'tgt-b'],
    });
    const uc = new CreateEdge({ nodeRepo, edgeRepo });

    const result = await uc.execute({
      source_id: 'src-a',
      target_id: 'tgt-b',
      type: 'DEPENDS_ON',
    });

    expect(result.source_id).toBe('src-a');
    expect(result.target_id).toBe('tgt-b');
    expect(result.type).toBe('DEPENDS_ON');
    expect(savedEdges.length).toBe(1);
  });

  it('creates an edge with label and metadata', async () => {
    const { nodeRepo, edgeRepo } = createMockRepos({ nodeIds: ['a', 'b'] });
    const uc = new CreateEdge({ nodeRepo, edgeRepo });

    const result = await uc.execute({
      source_id: 'a',
      target_id: 'b',
      type: 'CONTROLS',
      label: 'monitors',
      metadata: '{"key":"val"}',
    });

    expect(result.label).toBe('monitors');
    expect(result.metadata).toBe('{"key":"val"}');
  });

  it('throws ValidationError for invalid edge type', async () => {
    const { nodeRepo, edgeRepo } = createMockRepos({ nodeIds: ['a', 'b'] });
    const uc = new CreateEdge({ nodeRepo, edgeRepo });

    await expect(
      uc.execute({ source_id: 'a', target_id: 'b', type: 'INVALID' as Edge['type'] })
    ).rejects.toThrow(/type/i);
  });

  it('throws ValidationError when source node does not exist', async () => {
    const { nodeRepo, edgeRepo } = createMockRepos({ nodeIds: ['b'] });
    const uc = new CreateEdge({ nodeRepo, edgeRepo });

    await expect(
      uc.execute({ source_id: 'missing', target_id: 'b', type: 'DEPENDS_ON' })
    ).rejects.toThrow(/source/i);
  });

  it('throws ValidationError when target node does not exist', async () => {
    const { nodeRepo, edgeRepo } = createMockRepos({ nodeIds: ['a'] });
    const uc = new CreateEdge({ nodeRepo, edgeRepo });

    await expect(
      uc.execute({ source_id: 'a', target_id: 'missing', type: 'DEPENDS_ON' })
    ).rejects.toThrow(/target/i);
  });

  it('throws ValidationError for self-referencing edge', async () => {
    const { nodeRepo, edgeRepo } = createMockRepos({ nodeIds: ['self'] });
    const uc = new CreateEdge({ nodeRepo, edgeRepo });

    await expect(
      uc.execute({ source_id: 'self', target_id: 'self', type: 'DEPENDS_ON' })
    ).rejects.toThrow(/self-referencing/i);
  });

  it('throws EdgeExistsError for duplicate edge', async () => {
    const existing = new Edge({
      id: 1,
      source_id: 'a',
      target_id: 'b',
      type: 'DEPENDS_ON',
    });
    const { nodeRepo, edgeRepo } = createMockRepos({
      nodeIds: ['a', 'b'],
      existingEdges: [existing],
    });
    const uc = new CreateEdge({ nodeRepo, edgeRepo });

    await expect(
      uc.execute({ source_id: 'a', target_id: 'b', type: 'DEPENDS_ON' })
    ).rejects.toThrow(/already exists/i);
  });
});
