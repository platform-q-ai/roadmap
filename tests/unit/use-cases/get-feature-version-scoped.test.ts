import type { Feature, IFeatureRepository, INodeRepository } from '@domain/index.js';
import { GetFeatureVersionScoped } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function makeMockFeature(f: {
  node_id: string;
  version: string;
  filename: string;
  content?: string | null;
}) {
  const content =
    f.content !== undefined ? f.content : `Feature: ${f.filename}\n  Scenario: S\n    Given a step`;
  return {
    ...f,
    id: null,
    title: f.filename,
    content,
    step_count: content ? 1 : 0,
    updated_at: null,
    toJSON: vi.fn().mockReturnValue({ ...f, content }),
  } as unknown as Feature;
}

function buildMockRepos(opts: {
  nodeExists?: boolean;
  features?: Array<{ node_id: string; version: string; filename: string }>;
}) {
  const nodeRepo: Pick<INodeRepository, 'exists'> = {
    exists: vi.fn(async () => opts.nodeExists ?? true),
  };
  const features = (opts.features ?? []).map(f => makeMockFeature(f));
  const featureRepo: Pick<
    IFeatureRepository,
    'findByNode' | 'findByNodeAndVersion' | 'findByNodeVersionAndFilename'
  > = {
    findByNode: vi.fn(async (nid: string) => features.filter(f => f.node_id === nid)),
    findByNodeAndVersion: vi.fn(async (nid: string, ver: string) =>
      features.filter(f => f.node_id === nid && f.version === ver)
    ),
    findByNodeVersionAndFilename: vi.fn(
      async (nid: string, ver: string, fname: string) =>
        features.find(f => f.node_id === nid && f.version === ver && f.filename === fname) ?? null
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
      const repos = buildMockRepos({ nodeExists: true, features: [] });
      const nullFeature = makeMockFeature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'empty.feature',
        content: null,
      });
      vi.mocked(repos.featureRepo.findByNodeAndVersion).mockResolvedValueOnce([nullFeature]);
      const uc = new GetFeatureVersionScoped(repos);
      const result = await uc.executeList('comp-1', 'v1');
      expect(result.totals.total_scenarios).toBe(0);
      expect(result.totals.total_given_steps).toBe(0);
      expect(result.totals.total_when_steps).toBe(0);
      expect(result.totals.total_then_steps).toBe(0);
    });

    it('counts And/But steps under their preceding primary keyword', async () => {
      const repos = buildMockRepos({ nodeExists: true, features: [] });
      const gherkin = [
        'Feature: And/But test',
        '  Scenario: S1',
        '    Given a precondition',
        '    And another given',
        '    When an action',
        '    And another when-action',
        '    Then a result',
        '    But not this result',
      ].join('\n');
      const feat = makeMockFeature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'and-but.feature',
        content: gherkin,
      });
      vi.mocked(repos.featureRepo.findByNodeAndVersion).mockResolvedValueOnce([feat]);
      const uc = new GetFeatureVersionScoped(repos);
      const result = await uc.executeList('comp-1', 'v1');
      expect(result.totals.total_given_steps).toBe(2);
      expect(result.totals.total_when_steps).toBe(2);
      expect(result.totals.total_then_steps).toBe(2);
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
      expect(result.feature.filename).toBe('auth.feature');
      expect(result.enriched.scenario_count).toBeGreaterThanOrEqual(0);
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
