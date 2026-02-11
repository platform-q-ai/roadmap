import { Feature } from '@domain/entities/feature.js';
import type { IFeatureRepository } from '@domain/repositories/feature-repository.js';
import type { INodeRepository } from '@domain/repositories/node-repository.js';
import { SeedFeatures } from '@use-cases/seed-features.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(existingNodeIds: string[]) {
  const savedFeatures: Feature[] = [];
  let deleteAllCalled = false;

  const nodeRepo: INodeRepository = {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findByType: vi.fn(),
    findByLayer: vi.fn(),
    exists: vi.fn().mockImplementation(async (id: string) => existingNodeIds.includes(id)),
    save: vi.fn(),
    delete: vi.fn(),
  };

  const featureRepo: IFeatureRepository = {
    findAll: vi.fn().mockResolvedValue([]),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn().mockImplementation(async (f: Feature) => {
      savedFeatures.push(f);
    }),
    deleteAll: vi.fn().mockImplementation(async () => {
      deleteAllCalled = true;
    }),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(),
  };

  return {
    nodeRepo,
    featureRepo,
    getSavedFeatures: () => savedFeatures,
    wasDeleteAllCalled: () => deleteAllCalled,
  };
}

describe('SeedFeatures', () => {
  it('seeds a feature file for an existing node', async () => {
    const { nodeRepo, featureRepo, getSavedFeatures } = createMockRepos(['worker']);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    const result = await uc.execute([
      {
        nodeId: 'worker',
        filename: 'mvp-exec.feature',
        content: 'Feature: Task Execution\n  Scenario: Run',
      },
    ]);

    expect(result.seeded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(getSavedFeatures()).toHaveLength(1);
    expect(getSavedFeatures()[0].title).toBe('Task Execution');
    expect(getSavedFeatures()[0].version).toBe('mvp');
  });

  it('derives version v1 from filename prefix', async () => {
    const { nodeRepo, featureRepo, getSavedFeatures } = createMockRepos(['comp']);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    await uc.execute([
      { nodeId: 'comp', filename: 'v1-advanced.feature', content: 'Feature: Adv' },
    ]);

    expect(getSavedFeatures()[0].version).toBe('v1');
  });

  it('derives version v2 from filename prefix', async () => {
    const { nodeRepo, featureRepo, getSavedFeatures } = createMockRepos(['comp']);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    await uc.execute([
      { nodeId: 'comp', filename: 'v2-future.feature', content: 'Feature: Future' },
    ]);

    expect(getSavedFeatures()[0].version).toBe('v2');
  });

  it('defaults to mvp version when no prefix matches', async () => {
    const { nodeRepo, featureRepo, getSavedFeatures } = createMockRepos(['comp']);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    await uc.execute([{ nodeId: 'comp', filename: 'basic.feature', content: 'Feature: Basic' }]);

    expect(getSavedFeatures()[0].version).toBe('mvp');
  });

  it('skips feature files for unknown nodes', async () => {
    const { nodeRepo, featureRepo, getSavedFeatures } = createMockRepos([]);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    const result = await uc.execute([
      { nodeId: 'nonexistent', filename: 'mvp-x.feature', content: 'Feature: X' },
    ]);

    expect(result.seeded).toBe(0);
    expect(result.skipped).toBe(1);
    expect(getSavedFeatures()).toHaveLength(0);
  });

  it('clears all features before re-seeding', async () => {
    const { nodeRepo, featureRepo, wasDeleteAllCalled } = createMockRepos(['comp']);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    await uc.execute([{ nodeId: 'comp', filename: 'mvp-a.feature', content: 'Feature: A' }]);

    expect(wasDeleteAllCalled()).toBe(true);
    expect(featureRepo.deleteAll).toHaveBeenCalledBefore(featureRepo.save);
  });

  it('extracts title from Gherkin Feature line', async () => {
    const { nodeRepo, featureRepo, getSavedFeatures } = createMockRepos(['comp']);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    await uc.execute([
      {
        nodeId: 'comp',
        filename: 'mvp-test.feature',
        content: 'Feature: My Custom Title\n  Scenario: test',
      },
    ]);

    expect(getSavedFeatures()[0].title).toBe('My Custom Title');
  });

  it('falls back to filename when no Feature line', async () => {
    const { nodeRepo, featureRepo, getSavedFeatures } = createMockRepos(['comp']);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    await uc.execute([{ nodeId: 'comp', filename: 'mvp-notes.feature', content: 'Some notes' }]);

    expect(getSavedFeatures()[0].title).toBe('mvp-notes');
  });

  it('handles multiple files with mixed existing and missing nodes', async () => {
    const { nodeRepo, featureRepo, getSavedFeatures } = createMockRepos(['exists']);
    const uc = new SeedFeatures({ featureRepo, nodeRepo });

    const result = await uc.execute([
      { nodeId: 'exists', filename: 'mvp-a.feature', content: 'Feature: A' },
      { nodeId: 'missing', filename: 'mvp-b.feature', content: 'Feature: B' },
      { nodeId: 'exists', filename: 'v1-c.feature', content: 'Feature: C' },
    ]);

    expect(result.seeded).toBe(2);
    expect(result.skipped).toBe(1);
    expect(getSavedFeatures()).toHaveLength(2);
  });
});
