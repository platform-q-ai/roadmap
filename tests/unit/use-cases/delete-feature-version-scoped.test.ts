import type { IFeatureRepository, INodeRepository } from '@domain/index.js';
import { DeleteFeatureVersionScoped } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function buildMockRepos(opts: {
  nodeExists?: boolean;
  featureDeleted?: boolean;
  versionDeletedCount?: number;
}) {
  const nodeRepo: Pick<INodeRepository, 'exists'> = {
    exists: vi.fn(async () => opts.nodeExists ?? true),
  };
  const featureRepo: Pick<
    IFeatureRepository,
    'deleteByNodeAndVersionAndFilename' | 'deleteByNodeAndVersion' | 'deleteByNode'
  > = {
    deleteByNodeAndVersionAndFilename: vi.fn(async () => opts.featureDeleted ?? true),
    deleteByNodeAndVersion: vi.fn(async () => opts.versionDeletedCount ?? 0),
    deleteByNode: vi.fn(async () => undefined),
  };
  return {
    nodeRepo: nodeRepo as INodeRepository,
    featureRepo: featureRepo as IFeatureRepository,
  };
}

describe('DeleteFeatureVersionScoped use case', () => {
  describe('executeSingle', () => {
    it('deletes a single feature by node, version, and filename', async () => {
      const repos = buildMockRepos({ nodeExists: true, featureDeleted: true });
      const uc = new DeleteFeatureVersionScoped(repos);
      await expect(uc.executeSingle('comp-1', 'v1', 'test.feature')).resolves.toBeUndefined();
      expect(repos.nodeRepo.exists).toHaveBeenCalledWith('comp-1');
      expect(repos.featureRepo.deleteByNodeAndVersionAndFilename).toHaveBeenCalledWith(
        'comp-1',
        'v1',
        'test.feature'
      );
    });

    it('throws NodeNotFoundError when the component does not exist', async () => {
      const repos = buildMockRepos({ nodeExists: false });
      const uc = new DeleteFeatureVersionScoped(repos);
      await expect(uc.executeSingle('ghost', 'v1', 'test.feature')).rejects.toThrow(/not found/i);
    });

    it('throws FeatureNotFoundError when the feature does not exist', async () => {
      const repos = buildMockRepos({ nodeExists: true, featureDeleted: false });
      const uc = new DeleteFeatureVersionScoped(repos);
      await expect(uc.executeSingle('comp-1', 'v1', 'missing.feature')).rejects.toThrow(
        /not found/i
      );
    });
  });

  describe('executeVersion', () => {
    it('deletes all features for a node and version', async () => {
      const repos = buildMockRepos({ nodeExists: true, versionDeletedCount: 3 });
      const uc = new DeleteFeatureVersionScoped(repos);
      const count = await uc.executeVersion('comp-1', 'v1');
      expect(count).toBe(3);
      expect(repos.nodeRepo.exists).toHaveBeenCalledWith('comp-1');
      expect(repos.featureRepo.deleteByNodeAndVersion).toHaveBeenCalledWith('comp-1', 'v1');
    });

    it('throws NodeNotFoundError when the component does not exist', async () => {
      const repos = buildMockRepos({ nodeExists: false });
      const uc = new DeleteFeatureVersionScoped(repos);
      await expect(uc.executeVersion('ghost', 'v1')).rejects.toThrow(/not found/i);
    });

    it('returns 0 when no features exist for the version', async () => {
      const repos = buildMockRepos({ nodeExists: true, versionDeletedCount: 0 });
      const uc = new DeleteFeatureVersionScoped(repos);
      const count = await uc.executeVersion('comp-1', 'v1');
      expect(count).toBe(0);
    });
  });

  describe('executeAll', () => {
    it('deletes all features for a node across all versions', async () => {
      const repos = buildMockRepos({ nodeExists: true });
      const uc = new DeleteFeatureVersionScoped(repos);
      await expect(uc.executeAll('comp-1')).resolves.toBeUndefined();
      expect(repos.nodeRepo.exists).toHaveBeenCalledWith('comp-1');
      expect(repos.featureRepo.deleteByNode).toHaveBeenCalledWith('comp-1');
    });

    it('throws NodeNotFoundError when the component does not exist', async () => {
      const repos = buildMockRepos({ nodeExists: false });
      const uc = new DeleteFeatureVersionScoped(repos);
      await expect(uc.executeAll('ghost')).rejects.toThrow(/not found/i);
    });
  });
});
