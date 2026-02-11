import type { IFeatureRepository } from '@domain/repositories/feature-repository.js';
import type { INodeRepository } from '@domain/repositories/node-repository.js';
import { DeleteFeature } from '@use-cases/delete-feature.js';
import { describe, expect, it, vi } from 'vitest';

function buildMockRepos(opts: { nodeExists?: boolean; featureDeleted?: boolean }) {
  const nodeRepo: Pick<INodeRepository, 'exists'> = {
    exists: vi.fn(async () => opts.nodeExists ?? true),
  };
  const featureRepo: Pick<IFeatureRepository, 'deleteByNodeAndFilename'> = {
    deleteByNodeAndFilename: vi.fn(async () => opts.featureDeleted ?? true),
  };
  return { nodeRepo: nodeRepo as INodeRepository, featureRepo: featureRepo as IFeatureRepository };
}

describe('DeleteFeature use case', () => {
  it('deletes a feature for an existing component', async () => {
    const repos = buildMockRepos({ nodeExists: true, featureDeleted: true });
    const uc = new DeleteFeature(repos);
    await expect(uc.execute('comp-1', 'mvp-test.feature')).resolves.toBeUndefined();
    expect(repos.nodeRepo.exists).toHaveBeenCalledWith('comp-1');
    expect(repos.featureRepo.deleteByNodeAndFilename).toHaveBeenCalledWith(
      'comp-1',
      'mvp-test.feature'
    );
  });

  it('throws when the component does not exist', async () => {
    const repos = buildMockRepos({ nodeExists: false });
    const uc = new DeleteFeature(repos);
    await expect(uc.execute('ghost', 'mvp-test.feature')).rejects.toThrow(/not found/i);
  });

  it('throws when the feature file does not exist', async () => {
    const repos = buildMockRepos({ nodeExists: true, featureDeleted: false });
    const uc = new DeleteFeature(repos);
    await expect(uc.execute('comp-1', 'mvp-missing.feature')).rejects.toThrow(/not found/i);
  });
});
