import type { IEdgeRepository } from '@domain/index.js';
import { Edge } from '@domain/index.js';
import { DeleteEdge } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(existingEdges: Edge[] = []) {
  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn(),
    findById: vi.fn().mockImplementation(async (id: number) => {
      return existingEdges.find(e => e.id === id) ?? null;
    }),
    findBySource: vi.fn(),
    findByTarget: vi.fn(),
    findByType: vi.fn(),
    findRelationships: vi.fn(),
    existsBySrcTgtType: vi.fn(),
    save: vi.fn(),
    delete: vi.fn().mockImplementation(async (id: number) => {
      const idx = existingEdges.findIndex(e => e.id === id);
      if (idx >= 0) {
        existingEdges.splice(idx, 1);
      }
    }),
  };

  return { edgeRepo };
}

describe('DeleteEdge', () => {
  it('deletes an existing edge', async () => {
    const edge = new Edge({
      id: 42,
      source_id: 'a',
      target_id: 'b',
      type: 'DEPENDS_ON',
    });
    const { edgeRepo } = createMockRepos([edge]);
    const uc = new DeleteEdge({ edgeRepo });

    await uc.execute(42);

    expect(edgeRepo.delete).toHaveBeenCalledWith(42);
  });

  it('throws EdgeNotFoundError when edge does not exist', async () => {
    const { edgeRepo } = createMockRepos([]);
    const uc = new DeleteEdge({ edgeRepo });

    await expect(uc.execute(99999)).rejects.toThrow(/not found/i);
  });
});
