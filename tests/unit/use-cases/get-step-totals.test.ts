import { Feature } from '@domain/entities/feature.js';
import type { IFeatureRepository } from '@domain/repositories/feature-repository.js';
import { GetStepTotals } from '@use-cases/get-step-totals.js';
import { describe, expect, it, vi } from 'vitest';

function createMockFeatureRepo(features: Feature[] = []): IFeatureRepository {
  return {
    findAll: vi.fn().mockResolvedValue(features),
    findByNode: vi
      .fn()
      .mockImplementation(async (nid: string) => features.filter(f => f.node_id === nid)),
    findByNodeAndVersion: vi
      .fn()
      .mockImplementation(async (nid: string, ver: string) =>
        features.filter(f => f.node_id === nid && f.version === ver)
      ),
    getStepCountSummary: vi.fn().mockImplementation(async (nid: string, ver: string) => {
      const matched = features.filter(f => f.node_id === nid && f.version === ver);
      return {
        totalSteps: matched.reduce((sum, f) => sum + f.step_count, 0),
        featureCount: matched.length,
      };
    }),
    save: vi.fn(),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(),
  };
}

describe('GetStepTotals', () => {
  it('aggregates step counts across multiple features for a version', async () => {
    const features = [
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'auth.feature',
        title: 'Auth',
        step_count: 12,
      }),
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'perms.feature',
        title: 'Perms',
        step_count: 8,
      }),
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'rate.feature',
        title: 'Rate',
        step_count: 15,
      }),
    ];
    const repo = createMockFeatureRepo(features);
    const useCase = new GetStepTotals({ featureRepo: repo });

    const result = await useCase.execute('comp-1', 'v1');

    expect(result.totalSteps).toBe(35);
    expect(result.featureCount).toBe(3);
  });

  it('returns 0 total steps and 0 feature count when no features exist', async () => {
    const repo = createMockFeatureRepo([]);
    const useCase = new GetStepTotals({ featureRepo: repo });

    const result = await useCase.execute('no-comp', 'v1');

    expect(result.totalSteps).toBe(0);
    expect(result.featureCount).toBe(0);
  });

  it('counts steps independently per version', async () => {
    const features = [
      new Feature({
        node_id: 'comp-1',
        version: 'mvp',
        filename: 'mvp-a.feature',
        title: 'A',
        step_count: 20,
      }),
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'v1-a.feature',
        title: 'B',
        step_count: 45,
      }),
      new Feature({
        node_id: 'comp-1',
        version: 'v2',
        filename: 'v2-a.feature',
        title: 'C',
        step_count: 30,
      }),
    ];
    const repo = createMockFeatureRepo(features);
    const useCase = new GetStepTotals({ featureRepo: repo });

    const mvp = await useCase.execute('comp-1', 'mvp');
    const v1 = await useCase.execute('comp-1', 'v1');
    const v2 = await useCase.execute('comp-1', 'v2');

    expect(mvp.totalSteps).toBe(20);
    expect(v1.totalSteps).toBe(45);
    expect(v2.totalSteps).toBe(30);
  });

  it('only counts features for the requested component', async () => {
    const features = [
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'a.feature',
        title: 'A',
        step_count: 10,
      }),
      new Feature({
        node_id: 'comp-2',
        version: 'v1',
        filename: 'b.feature',
        title: 'B',
        step_count: 20,
      }),
    ];
    const repo = createMockFeatureRepo(features);
    const useCase = new GetStepTotals({ featureRepo: repo });

    const result = await useCase.execute('comp-1', 'v1');

    expect(result.totalSteps).toBe(10);
    expect(result.featureCount).toBe(1);
  });

  it('handles features with 0 step count', async () => {
    const features = [
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'a.feature',
        title: 'A',
        step_count: 0,
      }),
      new Feature({
        node_id: 'comp-1',
        version: 'v1',
        filename: 'b.feature',
        title: 'B',
        step_count: 5,
      }),
    ];
    const repo = createMockFeatureRepo(features);
    const useCase = new GetStepTotals({ featureRepo: repo });

    const result = await useCase.execute('comp-1', 'v1');

    expect(result.totalSteps).toBe(5);
    expect(result.featureCount).toBe(2);
  });

  it('calls getStepCountSummary on the feature repository', async () => {
    const repo = createMockFeatureRepo([]);
    const useCase = new GetStepTotals({ featureRepo: repo });

    await useCase.execute('comp-1', 'v1');

    expect(repo.getStepCountSummary).toHaveBeenCalledWith('comp-1', 'v1');
  });
});
