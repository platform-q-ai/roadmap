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
    findById: vi.fn(),
    findBySource: vi.fn(),
    findByTarget: vi.fn(),
    findByType: vi.fn(),
    findRelationships: vi.fn(),
    existsBySrcTgtType: vi.fn(),
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
    getStepCountSummary: vi.fn().mockResolvedValue({ totalSteps: 0, featureCount: 0 }),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(),
    deleteByNodeAndVersionAndFilename: vi.fn(),
    deleteByNodeAndVersion: vi.fn(),
    search: async () => [],
  };

  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

describe('GetArchitecture — package version sync', () => {
  it('overrides roadmap current_version with packageVersion', async () => {
    const nodes = [
      new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.7.5' }),
    ];
    const versions = [
      new Version({ node_id: 'roadmap', version: 'mvp', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute({ packageVersion: '1.0.0' });

    const roadmap = result.nodes.find(n => n.id === 'roadmap');
    expect(roadmap?.current_version).toBe('1.0.0');
  });

  it('updates derived progress for roadmap based on packageVersion', async () => {
    const nodes = [
      new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.7.5' }),
    ];
    const versions = [
      new Version({ node_id: 'roadmap', version: 'mvp', progress: 0, status: 'planned' }),
      new Version({ node_id: 'roadmap', version: 'v1', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute({ packageVersion: '1.0.0' });

    const roadmap = result.nodes.find(n => n.id === 'roadmap');
    expect(roadmap?.versions.mvp.progress).toBe(100);
    expect(roadmap?.versions.mvp.status).toBe('complete');
    expect(roadmap?.versions.v1.progress).toBe(0);
    expect(roadmap?.versions.v1.status).toBe('planned');
  });

  it('does not affect other nodes when packageVersion is provided', async () => {
    const nodes = [
      new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.7.5' }),
      new Node({ id: 'worker', name: 'Worker', type: 'app', current_version: '0.3.0' }),
    ];
    const versions = [
      new Version({ node_id: 'worker', version: 'mvp', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute({ packageVersion: '1.0.0' });

    const worker = result.nodes.find(n => n.id === 'worker');
    expect(worker?.current_version).toBe('0.3.0');
    expect(worker?.versions.mvp.progress).toBe(30);
  });

  it('preserves database current_version when no packageVersion given', async () => {
    const nodes = [
      new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.7.5' }),
    ];
    const versions = [
      new Version({ node_id: 'roadmap', version: 'mvp', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute();

    const roadmap = result.nodes.find(n => n.id === 'roadmap');
    expect(roadmap?.current_version).toBe('0.7.5');
    expect(roadmap?.versions.mvp.progress).toBe(75);
  });

  it('updates display_state based on packageVersion', async () => {
    const nodes = [
      new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.7.5' }),
    ];
    const repos = createMockRepos({ nodes });
    const result = await new GetArchitecture(repos).execute({ packageVersion: '1.0.0' });

    const roadmap = result.nodes.find(n => n.id === 'roadmap');
    expect(roadmap?.display_state).toBe('v1');
  });

  it('treats undefined packageVersion same as absent', async () => {
    const nodes = [
      new Node({ id: 'roadmap', name: 'Roadmap', type: 'app', current_version: '0.7.5' }),
    ];
    const versions = [
      new Version({ node_id: 'roadmap', version: 'mvp', progress: 0, status: 'planned' }),
    ];
    const repos = createMockRepos({ nodes, versions });
    const result = await new GetArchitecture(repos).execute({ packageVersion: undefined });

    const roadmap = result.nodes.find(n => n.id === 'roadmap');
    expect(roadmap?.current_version).toBe('0.7.5');
  });
});
