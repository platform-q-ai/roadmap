import { Node } from '@domain/entities/node.js';
import { Version } from '@domain/entities/version.js';
import type { IEdgeRepository } from '@domain/repositories/edge-repository.js';
import type { IFeatureRepository } from '@domain/repositories/feature-repository.js';
import type { INodeRepository } from '@domain/repositories/node-repository.js';
import type { IVersionRepository } from '@domain/repositories/version-repository.js';
import { ExportArchitecture } from '@use-cases/export-architecture.js';
import type { ArchitectureData } from '@use-cases/get-architecture.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos() {
  const nodes = [new Node({ id: 'comp', name: 'Comp', type: 'component' })];
  const versions = [new Version({ node_id: 'comp', version: 'mvp', content: 'MVP' })];

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
  };

  return { nodeRepo, edgeRepo, versionRepo, featureRepo };
}

describe('ExportArchitecture', () => {
  it('calls writeJson with the specified path', async () => {
    const repos = createMockRepos();
    const writeJson = vi.fn();
    const uc = new ExportArchitecture({ ...repos, writeJson });

    await uc.execute('web/data.json');

    expect(writeJson).toHaveBeenCalledOnce();
    expect(writeJson.mock.calls[0][0]).toBe('web/data.json');
  });

  it('writes the full architecture data', async () => {
    const repos = createMockRepos();
    let writtenData: ArchitectureData | undefined;
    const writeJson = vi.fn().mockImplementation((_path: string, data: ArchitectureData) => {
      writtenData = data;
    });
    const uc = new ExportArchitecture({ ...repos, writeJson });

    await uc.execute('out.json');

    expect(writtenData).toBeDefined();
    expect(writtenData?.generated_at).toBeDefined();
    expect(writtenData?.nodes).toHaveLength(1);
    expect(writtenData?.stats.total_nodes).toBe(1);
  });

  it('returns statistics from the export', async () => {
    const repos = createMockRepos();
    const writeJson = vi.fn();
    const uc = new ExportArchitecture({ ...repos, writeJson });

    const result = await uc.execute('out.json');

    expect(result.stats).toBeDefined();
    expect(result.stats.total_nodes).toBe(1);
    expect(result.stats.total_versions).toBe(1);
  });
});
