import { Node } from '@domain/entities/node.js';
import { Version } from '@domain/entities/version.js';
import type { IEdgeRepository } from '@domain/repositories/edge-repository.js';
import type { IFeatureRepository } from '@domain/repositories/feature-repository.js';
import type { INodeRepository } from '@domain/repositories/node-repository.js';
import type { IVersionRepository } from '@domain/repositories/version-repository.js';
import { GetArchitecture } from '@use-cases/get-architecture.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(
  overrides: {
    nodes?: Node[];
    versions?: Version[];
  } = {}
) {
  const nodes = overrides.nodes ?? [];
  const versions = overrides.versions ?? [];

  const nodeRepo: INodeRepository = {
    findAll: vi.fn().mockResolvedValue(nodes),
    findById: vi.fn(),
    findByType: vi.fn(),
    findByLayer: vi.fn(),
    exists: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const edgeRepo: IEdgeRepository = {
    findAll: vi.fn().mockResolvedValue([]),
    findBySource: vi.fn(),
    findByTarget: vi.fn(),
    findByType: vi.fn(),
    findRelationships: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const versionRepo: IVersionRepository = {
    findAll: vi.fn().mockResolvedValue(versions),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn(),
    deleteByNode: vi.fn(),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn().mockResolvedValue([]),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(),
  };

  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

describe('GetArchitecture — derived progress', () => {
  it('overrides manual progress with derived progress for MVP', async () => {
    const nodes = [
      new Node({ id: 'comp-1', name: 'Comp', type: 'component', current_version: '0.7.0' }),
    ];
    const versions = [
      new Version({ node_id: 'comp-1', version: 'mvp', progress: 20, status: 'in-progress' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'comp-1');
    expect(enriched?.versions.mvp.progress).toBe(70);
    expect(enriched?.versions.mvp.status).toBe('in-progress');
  });

  it('overrides manual progress with derived progress for v1', async () => {
    const nodes = [
      new Node({ id: 'comp-1', name: 'Comp', type: 'component', current_version: '1.4.0' }),
    ];
    const versions = [
      new Version({ node_id: 'comp-1', version: 'v1', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'comp-1');
    expect(enriched?.versions.v1.progress).toBe(40);
    expect(enriched?.versions.v1.status).toBe('in-progress');
  });

  it('overrides manual progress with derived progress for v2', async () => {
    const nodes = [
      new Node({ id: 'comp-1', name: 'Comp', type: 'component', current_version: '2.7.0' }),
    ];
    const versions = [
      new Version({ node_id: 'comp-1', version: 'v2', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'comp-1');
    expect(enriched?.versions.v2.progress).toBe(70);
    expect(enriched?.versions.v2.status).toBe('in-progress');
  });

  it('sets status to complete when derived progress is 100', async () => {
    const nodes = [
      new Node({ id: 'comp-1', name: 'Comp', type: 'component', current_version: '1.0.0' }),
    ];
    const versions = [
      new Version({ node_id: 'comp-1', version: 'mvp', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'comp-1');
    expect(enriched?.versions.mvp.progress).toBe(100);
    expect(enriched?.versions.mvp.status).toBe('complete');
  });

  it('keeps manual progress when node has no current_version', async () => {
    const nodes = [new Node({ id: 'comp-1', name: 'Comp', type: 'component' })];
    const versions = [
      new Version({ node_id: 'comp-1', version: 'mvp', progress: 40, status: 'in-progress' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'comp-1');
    expect(enriched?.versions.mvp.progress).toBe(40);
    expect(enriched?.versions.mvp.status).toBe('in-progress');
  });

  it('does not override overview version progress', async () => {
    const nodes = [
      new Node({ id: 'comp-1', name: 'Comp', type: 'component', current_version: '1.5.0' }),
    ];
    const versions = [
      new Version({ node_id: 'comp-1', version: 'overview', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'comp-1');
    expect(enriched?.versions.overview.progress).toBe(0);
    expect(enriched?.versions.overview.status).toBe('planned');
  });

  it('derives progress for multiple version tags on same node', async () => {
    const nodes = [
      new Node({ id: 'comp-1', name: 'Comp', type: 'component', current_version: '1.5.0' }),
    ];
    const versions = [
      new Version({ node_id: 'comp-1', version: 'mvp', progress: 0, status: 'planned' }),
      new Version({ node_id: 'comp-1', version: 'v1', progress: 0, status: 'planned' }),
      new Version({ node_id: 'comp-1', version: 'v2', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const enriched = result.nodes.find(n => n.id === 'comp-1');
    expect(enriched?.versions.mvp.progress).toBe(100);
    expect(enriched?.versions.mvp.status).toBe('complete');
    expect(enriched?.versions.v1.progress).toBe(50);
    expect(enriched?.versions.v1.status).toBe('in-progress');
    expect(enriched?.versions.v2.progress).toBe(0);
    expect(enriched?.versions.v2.status).toBe('planned');
  });
});
