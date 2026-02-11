import type { IEdgeRepository, INodeRepository, IVersionRepository } from '@domain/index.js';
import { Node, Version } from '@domain/index.js';
import { CreateComponent } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(existingNodeIds: string[] = []) {
  const savedNodes: Node[] = [];
  const savedVersions: Version[] = [];

  const nodeRepo: INodeRepository = {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByType: vi.fn(),
    findByLayer: vi.fn(),
    exists: vi.fn().mockImplementation(async (id: string) => existingNodeIds.includes(id)),
    save: vi.fn().mockImplementation(async (node: Node) => {
      savedNodes.push(node);
    }),
    delete: vi.fn(),
  };

  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn(),
    findBySource: vi.fn(),
    findByTarget: vi.fn(),
    findByType: vi.fn(),
    findRelationships: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const versionRepo: IVersionRepository = {
    findAll: vi.fn(),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn().mockImplementation(async (version: Version) => {
      savedVersions.push(version);
    }),
    updateProgress: vi.fn(),
    deleteByNode: vi.fn(),
  };

  return { nodeRepo, edgeRepo, versionRepo, savedNodes, savedVersions };
}

describe('CreateComponent', () => {
  it('creates a node with required fields', async () => {
    const { nodeRepo, edgeRepo, versionRepo, savedNodes } = createMockRepos();
    const uc = new CreateComponent({ nodeRepo, edgeRepo, versionRepo });

    await uc.execute({
      id: 'new-svc',
      name: 'New Service',
      type: 'app',
      layer: 'supervisor-layer',
    });

    expect(savedNodes).toHaveLength(1);
    expect(savedNodes[0].id).toBe('new-svc');
    expect(savedNodes[0].name).toBe('New Service');
    expect(savedNodes[0].type).toBe('app');
  });

  it('creates a CONTAINS edge from layer to node', async () => {
    const { nodeRepo, edgeRepo, versionRepo } = createMockRepos();
    const uc = new CreateComponent({ nodeRepo, edgeRepo, versionRepo });

    await uc.execute({
      id: 'new-svc',
      name: 'New Service',
      type: 'app',
      layer: 'supervisor-layer',
    });

    expect(edgeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source_id: 'supervisor-layer',
        target_id: 'new-svc',
        type: 'CONTAINS',
      })
    );
  });

  it('creates default version entries (overview, mvp, v1, v2)', async () => {
    const { nodeRepo, edgeRepo, versionRepo, savedVersions } = createMockRepos();
    const uc = new CreateComponent({ nodeRepo, edgeRepo, versionRepo });

    await uc.execute({
      id: 'new-svc',
      name: 'New Service',
      type: 'app',
      layer: 'supervisor-layer',
    });

    expect(savedVersions).toHaveLength(4);
    const versionTags = savedVersions.map(v => v.version);
    expect(versionTags).toContain('overview');
    expect(versionTags).toContain('mvp');
    expect(versionTags).toContain('v1');
    expect(versionTags).toContain('v2');
  });

  it('sets all default versions to progress 0 and status planned', async () => {
    const { nodeRepo, edgeRepo, versionRepo, savedVersions } = createMockRepos();
    const uc = new CreateComponent({ nodeRepo, edgeRepo, versionRepo });

    await uc.execute({
      id: 'new-svc',
      name: 'New Service',
      type: 'app',
      layer: 'supervisor-layer',
    });

    for (const v of savedVersions) {
      expect(v.progress).toBe(0);
      expect(v.status).toBe('planned');
    }
  });

  it('saves description and tags when provided', async () => {
    const { nodeRepo, edgeRepo, versionRepo, savedNodes } = createMockRepos();
    const uc = new CreateComponent({ nodeRepo, edgeRepo, versionRepo });

    await uc.execute({
      id: 'audit',
      name: 'Audit Log',
      type: 'component',
      layer: 'observability-dashboard',
      description: 'Tracks changes',
      tags: ['logging', 'audit'],
    });

    expect(savedNodes[0].description).toBe('Tracks changes');
    expect(savedNodes[0].tags).toEqual(['logging', 'audit']);
  });

  it('throws when node id already exists', async () => {
    const { nodeRepo, edgeRepo, versionRepo } = createMockRepos(['existing']);
    const uc = new CreateComponent({ nodeRepo, edgeRepo, versionRepo });

    await expect(
      uc.execute({
        id: 'existing',
        name: 'Dup',
        type: 'app',
        layer: 'supervisor-layer',
      })
    ).rejects.toThrow('already exists');
  });

  it('throws for invalid node type', async () => {
    const { nodeRepo, edgeRepo, versionRepo } = createMockRepos();
    const uc = new CreateComponent({ nodeRepo, edgeRepo, versionRepo });

    await expect(
      uc.execute({
        id: 'bad',
        name: 'Bad',
        type: 'invalid' as 'app',
        layer: 'supervisor-layer',
      })
    ).rejects.toThrow('Invalid node type');
  });
});
