import type {
  IEdgeRepository,
  IFeatureRepository,
  INodeRepository,
  IVersionRepository,
} from '@domain/index.js';
import { Edge, Node } from '@domain/index.js';
import { DeleteComponent } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(existingNodes: Node[] = [], existingEdges: Edge[] = []) {
  const nodeRepo: INodeRepository = {
    findAll: vi.fn(),
    findById: vi
      .fn()
      .mockImplementation(async (id: string) => existingNodes.find(n => n.id === id) ?? null),
    findByType: vi.fn(),
    findByLayer: vi.fn(),
    exists: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn(),
    findBySource: vi
      .fn()
      .mockImplementation(async (sid: string) => existingEdges.filter(e => e.source_id === sid)),
    findByTarget: vi
      .fn()
      .mockImplementation(async (tid: string) => existingEdges.filter(e => e.target_id === tid)),
    findByType: vi.fn(),
    findRelationships: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const versionRepo: IVersionRepository = {
    findAll: vi.fn(),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn(),
    deleteByNode: vi.fn(),
  };

  const featureRepo: IFeatureRepository = {
    findAll: vi.fn(),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
  };

  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

describe('DeleteComponent', () => {
  it('deletes node, versions, features, and edges', async () => {
    const node = new Node({ id: 'doomed', name: 'Doomed', type: 'component' });
    const edge = new Edge({
      id: 1,
      source_id: 'supervisor-layer',
      target_id: 'doomed',
      type: 'CONTAINS',
    });
    const repos = createMockRepos([node], [edge]);
    const uc = new DeleteComponent(repos);

    await uc.execute('doomed');

    expect(repos.versionRepo.deleteByNode).toHaveBeenCalledWith('doomed');
    expect(repos.featureRepo.deleteByNode).toHaveBeenCalledWith('doomed');
    expect(repos.edgeRepo.delete).toHaveBeenCalledWith(1);
    expect(repos.nodeRepo.delete).toHaveBeenCalledWith('doomed');
  });

  it('deletes edges where node is source or target', async () => {
    const node = new Node({ id: 'mid', name: 'Mid', type: 'app' });
    const edgeIn = new Edge({
      id: 1,
      source_id: 'layer',
      target_id: 'mid',
      type: 'CONTAINS',
    });
    const edgeOut = new Edge({
      id: 2,
      source_id: 'mid',
      target_id: 'other',
      type: 'DEPENDS_ON',
    });
    const repos = createMockRepos([node], [edgeIn, edgeOut]);
    const uc = new DeleteComponent(repos);

    await uc.execute('mid');

    expect(repos.edgeRepo.delete).toHaveBeenCalledWith(1);
    expect(repos.edgeRepo.delete).toHaveBeenCalledWith(2);
  });

  it('throws when node does not exist', async () => {
    const repos = createMockRepos();
    const uc = new DeleteComponent(repos);

    await expect(uc.execute('ghost')).rejects.toThrow('Node not found');
  });
});
