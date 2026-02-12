import type { IFeatureRepository, INodeRepository } from '@domain/index.js';
import { Feature, Node } from '@domain/index.js';
import { describe, expect, it, vi } from 'vitest';

/* ──────────────────────────────────────────────────────────────────
 * Unit tests for UploadFeature Gherkin validation.
 *
 * V1 validation adds:
 * 1. Empty content rejection
 * 2. Missing Feature: keyword rejection
 * 3. Missing scenarios rejection
 * 4. Missing steps rejection
 * 5. Invalid file extension rejection (must be .feature)
 * 6. Non-kebab-case filename rejection
 * 7. Syntax error with line number in error message
 * ────────────────────────────────────────────────────────────────── */

const VALID_GHERKIN = `Feature: Valid
  Scenario: S1
    Given step one
    When action one
    Then result one`;

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
    deleteByNodeAndVersionAndFilename: vi.fn(async () => false),
    deleteByNodeAndVersion: vi.fn(async () => 0),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
    search: vi.fn(async () => []),
  };
  return { nodeRepo, featureRepo };
}

describe('UploadFeature — Gherkin validation', () => {
  it('rejects empty content', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({ nodeId: 'comp-a', version: 'v1', filename: 'test.feature', content: '' })
    ).rejects.toThrow(/empty/i);
  });

  it('rejects whitespace-only content', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({ nodeId: 'comp-a', version: 'v1', filename: 'test.feature', content: '   \n  ' })
    ).rejects.toThrow(/empty/i);
  });

  it('rejects content without Feature: keyword', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({
        nodeId: 'comp-a',
        version: 'v1',
        filename: 'test.feature',
        content: 'This has no Feature keyword',
      })
    ).rejects.toThrow(/Feature/);
  });

  it('rejects content without any scenarios', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({
        nodeId: 'comp-a',
        version: 'v1',
        filename: 'test.feature',
        content: 'Feature: No Scenarios\n  Just a description.',
      })
    ).rejects.toThrow(/scenario/i);
  });

  it('rejects content with scenarios but no steps', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({
        nodeId: 'comp-a',
        version: 'v1',
        filename: 'test.feature',
        content: 'Feature: Stepless\n  Scenario: Empty scenario',
      })
    ).rejects.toThrow(/steps/i);
  });

  it('rejects filename without .feature extension', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({
        nodeId: 'comp-a',
        version: 'v1',
        filename: 'test.txt',
        content: VALID_GHERKIN,
      })
    ).rejects.toThrow(/\.feature/);
  });

  it('rejects non-kebab-case filename', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    await expect(
      uc.execute({
        nodeId: 'comp-a',
        version: 'v1',
        filename: 'under_score.feature',
        content: VALID_GHERKIN,
      })
    ).rejects.toThrow(/filename/i);
  });

  it('includes line number for syntax errors', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const content = [
      'Feature: Broken',
      '  Scenario: Has error',
      '    Given valid step',
      '    When valid action',
      '    !!!INVALID GHERKIN SYNTAX!!!',
      '    Then valid result',
    ].join('\n');
    await expect(
      uc.execute({
        nodeId: 'comp-a',
        version: 'v1',
        filename: 'broken.feature',
        content,
      })
    ).rejects.toThrow(/line\s*\d+/i);
  });

  it('accepts valid Gherkin with kebab-case .feature filename', async () => {
    const { UploadFeature } = await import('@use-cases/upload-feature.js');
    const { nodeRepo, featureRepo } = buildMocks();
    const uc = new UploadFeature({ featureRepo, nodeRepo });
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v1',
      filename: 'valid-test.feature',
      content: VALID_GHERKIN,
    });
    expect(result.filename).toBe('valid-test.feature');
    expect(result.step_count).toBe(3);
  });
});
