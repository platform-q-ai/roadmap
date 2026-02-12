import type { Feature, IFeatureRepository, INodeRepository } from '@domain/index.js';
import { describe, expect, it, vi } from 'vitest';

/* ──────────────────────────────────────────────────────────────────
 * Unit tests for SeedFeaturesApi use case.
 *
 * The use case wraps existing SeedFeatures with filesystem scanning
 * and post-seed step total computation.
 * ────────────────────────────────────────────────────────────────── */

function buildMockRepos(opts?: { nodeExists?: boolean; savedFeatures?: Feature[] }) {
  const saved: Feature[] = opts?.savedFeatures ?? [];
  const nodeRepo: Pick<INodeRepository, 'exists'> = {
    exists: vi.fn(async () => opts?.nodeExists ?? true),
  };
  const featureRepo: Pick<IFeatureRepository, 'deleteAll' | 'save' | 'findAll'> = {
    deleteAll: vi.fn(async () => {
      saved.length = 0;
    }),
    save: vi.fn(async (f: Feature) => {
      saved.push(f);
    }),
    findAll: vi.fn(async () => [...saved]),
  };
  return {
    nodeRepo: nodeRepo as INodeRepository,
    featureRepo: featureRepo as IFeatureRepository,
    saved,
  };
}

describe('SeedFeaturesApi use case', () => {
  it('seeds feature files and returns counts', async () => {
    const { SeedFeaturesApi } = await import('@use-cases/seed-features-api.js');
    const { nodeRepo, featureRepo } = buildMockRepos();
    const scanFn = vi.fn(async () => [
      {
        nodeId: 'comp-a',
        filename: 'mvp-basic.feature',
        content: 'Feature: Basic\n  Scenario: S\n    Given a step',
      },
    ]);
    const uc = new SeedFeaturesApi({
      featureRepo,
      nodeRepo,
      scanFeatureFiles: scanFn,
    });
    const result = await uc.execute();
    expect(result.seeded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(scanFn).toHaveBeenCalledOnce();
  });

  it('reports step_totals grouped by version', async () => {
    const { SeedFeaturesApi } = await import('@use-cases/seed-features-api.js');
    const { nodeRepo, featureRepo } = buildMockRepos();
    const scanFn = vi.fn(async () => [
      {
        nodeId: 'comp-a',
        filename: 'mvp-basic.feature',
        content: 'Feature: B\n  Scenario: S1\n    Given a step\n    When x\n    Then y',
      },
      {
        nodeId: 'comp-a',
        filename: 'v1-adv.feature',
        content:
          'Feature: A\n  Scenario: S1\n    Given a step\n  Scenario: S2\n    Given b\n    When c\n    Then d',
      },
    ]);
    // After seeding, featureRepo.findAll should return seeded features
    // The mock pushes to saved[] via save(), and findAll returns saved[]
    const uc = new SeedFeaturesApi({
      featureRepo,
      nodeRepo,
      scanFeatureFiles: scanFn,
    });
    const result = await uc.execute();
    expect(result.step_totals).toBeDefined();
    expect(typeof result.step_totals).toBe('object');
    // Should have entries for versions present in seeded features
    const versions = Object.keys(result.step_totals);
    expect(versions.length).toBeGreaterThan(0);
    // Each entry should have total_steps and total_scenarios
    for (const ver of versions) {
      expect(result.step_totals[ver]).toHaveProperty('total_steps');
      expect(result.step_totals[ver]).toHaveProperty('total_scenarios');
    }
  });

  it('skips features for non-existent nodes', async () => {
    const { SeedFeaturesApi } = await import('@use-cases/seed-features-api.js');
    const { nodeRepo, featureRepo } = buildMockRepos({
      nodeExists: false,
    });
    const scanFn = vi.fn(async () => [
      {
        nodeId: 'nonexistent',
        filename: 'mvp-test.feature',
        content: 'Feature: Test\n  Scenario: S\n    Given a step',
      },
    ]);
    const uc = new SeedFeaturesApi({
      featureRepo,
      nodeRepo,
      scanFeatureFiles: scanFn,
    });
    const result = await uc.execute();
    expect(result.seeded).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('clears existing features before seeding', async () => {
    const { SeedFeaturesApi } = await import('@use-cases/seed-features-api.js');
    const { nodeRepo, featureRepo } = buildMockRepos();
    const scanFn = vi.fn(async () => []);
    const uc = new SeedFeaturesApi({
      featureRepo,
      nodeRepo,
      scanFeatureFiles: scanFn,
    });
    await uc.execute();
    expect(featureRepo.deleteAll).toHaveBeenCalled();
  });

  it('returns empty step_totals when no features seeded', async () => {
    const { SeedFeaturesApi } = await import('@use-cases/seed-features-api.js');
    const { nodeRepo, featureRepo } = buildMockRepos();
    const scanFn = vi.fn(async () => []);
    const uc = new SeedFeaturesApi({
      featureRepo,
      nodeRepo,
      scanFeatureFiles: scanFn,
    });
    const result = await uc.execute();
    expect(result.seeded).toBe(0);
    expect(result.step_totals).toBeDefined();
    expect(Object.keys(result.step_totals)).toHaveLength(0);
  });
});
