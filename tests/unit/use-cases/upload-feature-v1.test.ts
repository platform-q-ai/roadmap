import type { IFeatureRepository, INodeRepository } from '@domain/index.js';
import { Feature, Node } from '@domain/index.js';
import { describe, expect, it, vi } from 'vitest';

/* ──────────────────────────────────────────────────────────────────
 * Unit tests for UploadFeature V1 (version-scoped upload).
 *
 * V1 adds:
 * 1. Explicit version parameter (not derived from filename)
 * 2. Version validation (must be mvp, v1, v2, etc.)
 * 3. Upsert: replace existing feature with same node+version+filename
 * 4. Step count breakdown (scenario_count, given_count, when_count, then_count)
 * ────────────────────────────────────────────────────────────────── */

function buildMocks() {
  const features: Feature[] = [];
  const nodes: Node[] = [
    new Node({ id: 'comp-a', name: 'A', type: 'component', layer: 'sup-layer' }),
  ];
  const nodeRepo: INodeRepository = {
    findAll: vi.fn(async () => nodes),
    findById: vi.fn(async (id: string) => nodes.find(n => n.id === id) ?? null),
    findByType: vi.fn(async () => []),
    findByLayer: vi.fn(async () => []),
    exists: vi.fn(async (id: string) => nodes.some(n => n.id === id)),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn(async () => features),
    findByNode: vi.fn(async (nid: string) => features.filter(f => f.node_id === nid)),
    findByNodeAndVersion: vi.fn(async (nid: string, ver: string) =>
      features.filter(f => f.node_id === nid && f.version === ver)
    ),
    findByNodeVersionAndFilename: vi.fn(
      async (nid: string, ver: string, fn: string) =>
        features.find(f => f.node_id === nid && f.version === ver && f.filename === fn) ?? null
    ),
    save: vi.fn(async (f: Feature) => {
      features.push(f);
    }),
    saveMany: vi.fn(),
    deleteAll: vi.fn(),
    deleteByNode: vi.fn(),
    deleteByNodeAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersionAndFilename: vi.fn(async (nid: string, ver: string, fn: string) => {
      const idx = features.findIndex(
        f => f.node_id === nid && f.version === ver && f.filename === fn
      );
      if (idx >= 0) {
        features.splice(idx, 1);
        return true;
      }
      return false;
    }),
    deleteByNodeAndVersion: vi.fn(async () => 0),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
    search: vi.fn(async () => []),
  };
  return { nodeRepo, featureRepo, features, nodes };
}

const GHERKIN = `Feature: Test
  Scenario: S1
    Given step one
    When action one
    Then result one`;

describe('UploadFeature V1 — version-scoped upload', () => {
  it('uses explicit version from input instead of deriving from filename', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v1',
      filename: 'mvp-legacy.feature',
      content: GHERKIN,
    });
    expect(result.version).toBe('v1');
    expect(result.filename).toBe('mvp-legacy.feature');
  });

  it('falls back to filename-derived version when no version provided', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const result = await uc.execute({
      nodeId: 'comp-a',
      filename: 'v2-future.feature',
      content: GHERKIN,
    });
    expect(result.version).toBe('v2');
  });

  it('returns step_count in the result', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v1',
      filename: 'test.feature',
      content: GHERKIN,
    });
    expect(result.step_count).toBe(3);
  });

  it('returns scenario_count in the result', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v1',
      filename: 'test.feature',
      content: `Feature: T\n  Scenario: A\n    Given x\n  Scenario: B\n    Given y`,
    });
    expect(result.scenario_count).toBe(2);
  });

  it('returns given_count, when_count, then_count in the result', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const content = `Feature: T
  Scenario: S
    Given a
    And b
    When c
    Then d
    And e
    But f`;
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v1',
      filename: 'test.feature',
      content,
    });
    // And/But inherit the preceding keyword's category
    expect(result.given_count).toBe(2);
    expect(result.when_count).toBe(1);
    expect(result.then_count).toBe(3);
  });

  it('validates version format and rejects invalid values', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({
        nodeId: 'comp-a',
        version: 'invalid',
        filename: 'test.feature',
        content: GHERKIN,
      })
    ).rejects.toThrow(/version/i);
  });

  it('accepts mvp as a valid version', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'mvp',
      filename: 'test.feature',
      content: GHERKIN,
    });
    expect(result.version).toBe('mvp');
  });

  it('replaces existing feature with same node+version+filename', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo, features } = buildMocks();
    // Pre-seed a feature
    features.push(
      new Feature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'test.feature',
        title: 'Old',
        content: 'Feature: Old\n  Scenario: S\n    Given old',
        step_count: 1,
      })
    );
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v1',
      filename: 'test.feature',
      content: 'Feature: New\n  Scenario: S\n    Given new\n    When act\n    Then done',
    });
    expect(result.title).toBe('New');
    // Should have deleted the old one first
    expect(featureRepo.deleteByNodeAndVersionAndFilename).toHaveBeenCalledWith(
      'comp-a',
      'v1',
      'test.feature'
    );
  });

  it('throws NodeNotFoundError for nonexistent component', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({
        nodeId: 'ghost',
        version: 'v1',
        filename: 'test.feature',
        content: GHERKIN,
      })
    ).rejects.toThrow(/not found/i);
  });

  it('extracts title from Feature: line', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v1',
      filename: 'test.feature',
      content: 'Feature: My Custom Title\n  Scenario: S\n    Given x',
    });
    expect(result.title).toBe('My Custom Title');
  });
});
