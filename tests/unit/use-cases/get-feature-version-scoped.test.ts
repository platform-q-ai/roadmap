import type { IFeatureRepository, INodeRepository } from '@domain/index.js';
import { GetFeatureVersionScoped } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function buildMockRepos(opts: {
  nodeExists?: boolean;
  features?: Array<{ node_id: string; version: string; filename: string }>;
}) {
  const nodeRepo: Pick<INodeRepository, 'exists'> = {
    exists: vi.fn(async () => opts.nodeExists ?? true),
  };
  const features = (opts.features ?? []).map(f => ({
    ...f,
    id: null,
    title: f.filename,
    content: `Feature: ${f.filename}\n  Scenario: S\n    Given a step`,
    step_count: 1,
    updated_at: null,
    toJSON: vi.fn().mockReturnValue(f),
  }));
  const featureRepo: Pick<IFeatureRepository, 'findByNode' | 'findByNodeAndVersion'> = {
    findByNode: vi.fn(async (nid: string) => features.filter(f => f.node_id === nid)),
    findByNodeAndVersion: vi.fn(async (nid: string, ver: string) =>
      features.filter(f => f.node_id === nid && f.version === ver)
    ),
  };
  return {
    nodeRepo: nodeRepo as INodeRepository,
    featureRepo: featureRepo as IFeatureRepository,
  };
}

describe('GetFeatureVersionScoped use case', () => {
  describe('executeList', () => {
    it('returns features for a specific version', async () => {
      const repos = buildMockRepos({
        nodeExists: true,
        features: [
          { node_id: 'comp-1', version: 'v1', filename: 'a.feature' },
          { node_id: 'comp-1', version: 'v1', filename: 'b.feature' },
          { node_id: 'comp-1', version: 'mvp', filename: 'c.feature' },
        ],
      });
      const uc = new GetFeatureVersionScoped(repos);
      const result = await uc.executeList('comp-1', 'v1');
      expect(result.features).toHaveLength(2);
    });

    it('throws NodeNotFoundError when the component does not exist', async () => {
      const repos = buildMockRepos({ nodeExists: false });
      const uc = new GetFeatureVersionScoped(repos);
      await expect(uc.executeList('ghost', 'v1')).rejects.toThrow(/not found/i);
    });

    it('returns empty array when no features exist for the version', async () => {
      const repos = buildMockRepos({ nodeExists: true, features: [] });
      const uc = new GetFeatureVersionScoped(repos);
      const result = await uc.executeList('comp-1', 'v1');
      expect(result.features).toHaveLength(0);
    });

    it('computes zero totals when features have null content', async () => {
      const repos = buildMockRepos({
        nodeExists: true,
        features: [{ node_id: 'comp-1', version: 'v1', filename: 'empty.feature' }],
      });
      // Override mock to return a feature with null content
      const nullFeature = {
        node_id: 'comp-1',
        version: 'v1',
        filename: 'empty.feature',
        id: null,
        title: 'empty.feature',
        content: null as string | null,
        step_count: 0,
        updated_at: null,
        toJSON: vi.fn().mockReturnValue({
          node_id: 'comp-1',
          version: 'v1',
          filename: 'empty.feature',
        }),
      };
      vi.mocked(repos.featureRepo.findByNodeAndVersion).mockResolvedValueOnce([
        nullFeature as unknown as import('@domain/index.js').Feature,
      ]);
      const uc = new GetFeatureVersionScoped(repos);
      const result = await uc.executeList('comp-1', 'v1');
      expect(result.totals.total_scenarios).toBe(0);
      expect(result.totals.total_given_steps).toBe(0);
      expect(result.totals.total_when_steps).toBe(0);
      expect(result.totals.total_then_steps).toBe(0);
    });
  });

  describe('executeSingle', () => {
    it('returns a single feature by version and filename', async () => {
      const repos = buildMockRepos({
        nodeExists: true,
        features: [
          { node_id: 'comp-1', version: 'v1', filename: 'auth.feature' },
          { node_id: 'comp-1', version: 'v1', filename: 'other.feature' },
        ],
      });
      const uc = new GetFeatureVersionScoped(repos);
      const result = await uc.executeSingle('comp-1', 'v1', 'auth.feature');
      expect(result).toBeDefined();
      expect(result.filename).toBe('auth.feature');
    });

    it('throws NodeNotFoundError when the component does not exist', async () => {
      const repos = buildMockRepos({ nodeExists: false });
      const uc = new GetFeatureVersionScoped(repos);
      await expect(uc.executeSingle('ghost', 'v1', 'a.feature')).rejects.toThrow(/not found/i);
    });

    it('throws FeatureNotFoundError when the feature does not exist', async () => {
      const repos = buildMockRepos({ nodeExists: true, features: [] });
      const uc = new GetFeatureVersionScoped(repos);
      await expect(uc.executeSingle('comp-1', 'v1', 'ghost.feature')).rejects.toThrow(/not found/i);
    });
  });
});
