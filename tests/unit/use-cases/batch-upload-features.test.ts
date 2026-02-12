import type { IFeatureRepository, INodeRepository } from '@domain/index.js';
import { Feature, Node } from '@domain/index.js';
import { describe, expect, it, vi } from 'vitest';

import { BatchUploadFeatures } from '../../../src/use-cases/index.js';

function buildDeps(
  nodes: Node[] = [],
  features: Feature[] = []
): { nodeRepo: INodeRepository; featureRepo: IFeatureRepository } {
  const nodeRepo: INodeRepository = {
    findAll: vi.fn(async () => nodes),
    findById: vi.fn(async (id: string) => nodes.find(n => n.id === id) ?? null),
    findByType: vi.fn(async () => []),
    findByLayer: vi.fn(async () => []),
    exists: vi.fn(async (id: string) => nodes.some(n => n.id === id)),
    save: vi.fn(async () => {}),
  };
  const featureRepo: IFeatureRepository = {
    findAll: vi.fn(async () => features),
    findByNode: vi.fn(async () => []),
    findByNodeAndVersion: vi.fn(async () => []),
    getStepCountSummary: vi.fn(async () => ({ totalSteps: 0, featureCount: 0 })),
    save: vi.fn(async (f: Feature) => {
      features.push(f);
    }),
    saveMany: vi.fn(async (fs: Feature[]) => {
      for (const f of fs) {
        features.push(f);
      }
    }),
    deleteAll: vi.fn(async () => {}),
    deleteByNode: vi.fn(async () => {}),
    deleteByNodeAndFilename: vi.fn(async () => false),
  };
  return { nodeRepo, featureRepo };
}

describe('BatchUploadFeatures use case', () => {
  describe('single-component batch', () => {
    it('uploads multiple features to a single component/version', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.execute({
        nodeId: 'comp-1',
        version: 'v1',
        features: [
          {
            filename: 'first.feature',
            content:
              'Feature: First\n  Scenario: S1\n    Given a step\n    When action\n    Then result',
          },
          {
            filename: 'second.feature',
            content: 'Feature: Second\n  Scenario: S2\n    Given another\n    Then result',
          },
        ],
      });

      expect(result.uploaded).toBe(2);
      expect(result.version).toBe('v1');
      expect(result.total_steps).toBe(5);
      expect(result.errors).toEqual([]);
    });

    it('returns error for feature with invalid Gherkin (no Feature: line)', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.execute({
        nodeId: 'comp-1',
        version: 'v1',
        features: [
          {
            filename: 'valid.feature',
            content: 'Feature: Valid\n  Scenario: S\n    Given a step',
          },
          {
            filename: 'invalid.feature',
            content: 'This is not valid Gherkin',
          },
        ],
      });

      expect(result.uploaded).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filename).toBe('invalid.feature');
    });

    it('returns error for feature entry missing filename', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.execute({
        nodeId: 'comp-1',
        version: 'v1',
        features: [
          {
            filename: '',
            content: 'Feature: No Name\n  Scenario: S\n    Given a step',
          },
        ],
      });

      expect(result.uploaded).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('throws NodeNotFoundError for non-existent component', async () => {
      const deps = buildDeps([]);
      const uc = new BatchUploadFeatures(deps);

      await expect(
        uc.execute({
          nodeId: 'no-such-comp',
          version: 'v1',
          features: [
            {
              filename: 'test.feature',
              content: 'Feature: Test\n  Scenario: S\n    Given a step',
            },
          ],
        })
      ).rejects.toThrow('not found');
    });

    it('throws ValidationError for empty features array', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      await expect(
        uc.execute({
          nodeId: 'comp-1',
          version: 'v1',
          features: [],
        })
      ).rejects.toThrow('features array must not be empty');
    });

    it('throws ValidationError when features exceed maximum of 50', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const features = Array.from({ length: 51 }, (_, i) => ({
        filename: `f-${i}.feature`,
        content: `Feature: F${i}\n  Scenario: S\n    Given a step`,
      }));

      await expect(uc.execute({ nodeId: 'comp-1', version: 'v1', features })).rejects.toThrow(
        'maximum 50'
      );
    });

    it('counts Given/When/Then/And/But steps correctly', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.execute({
        nodeId: 'comp-1',
        version: 'v1',
        features: [
          {
            filename: 'steps.feature',
            content:
              'Feature: Steps\n  Scenario: S\n    Given a\n    And b\n    When c\n    Then d\n    But e',
          },
        ],
      });

      expect(result.total_steps).toBe(5);
    });
  });

  describe('cross-component batch', () => {
    it('uploads features to multiple components with explicit versions', async () => {
      const nodes = [
        new Node({ id: 'cross-1', name: 'Cross 1', type: 'component', layer: 'layer-1' }),
        new Node({ id: 'cross-2', name: 'Cross 2', type: 'component', layer: 'layer-1' }),
      ];
      const deps = buildDeps(nodes);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.executeCrossComponent({
        features: [
          {
            node_id: 'cross-1',
            version: 'v1',
            filename: 'a.feature',
            content: 'Feature: A\n  Scenario: S\n    Given a step',
          },
          {
            node_id: 'cross-2',
            version: 'v2',
            filename: 'b.feature',
            content: 'Feature: B\n  Scenario: S\n    Given a step\n    Then a result',
          },
        ],
      });

      expect(result.uploaded).toBe(2);
      expect(result.errors).toEqual([]);
    });

    it('returns error for entry with non-existent component', async () => {
      const deps = buildDeps([]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.executeCrossComponent({
        features: [
          {
            node_id: 'nonexistent',
            version: 'v1',
            filename: 'ghost.feature',
            content: 'Feature: Ghost\n  Scenario: S\n    Given a step',
          },
        ],
      });

      expect(result.uploaded).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('throws ValidationError when entry is missing version field', async () => {
      const deps = buildDeps([]);
      const uc = new BatchUploadFeatures(deps);

      await expect(
        uc.executeCrossComponent({
          features: [
            {
              node_id: 'some-comp',
              version: '',
              filename: 'no-ver.feature',
              content: 'Feature: No Ver\n  Scenario: S\n    Given a step',
            },
          ],
        })
      ).rejects.toThrow('version is required');
    });

    it('throws ValidationError when entry is missing node_id field', async () => {
      const deps = buildDeps([]);
      const uc = new BatchUploadFeatures(deps);

      await expect(
        uc.executeCrossComponent({
          features: [
            {
              node_id: '',
              version: 'v1',
              filename: 'no-node.feature',
              content: 'Feature: No Node\n  Scenario: S\n    Given a step',
            },
          ],
        })
      ).rejects.toThrow('node_id is required');
    });

    it('throws ValidationError for empty features array in cross-component', async () => {
      const deps = buildDeps([]);
      const uc = new BatchUploadFeatures(deps);

      await expect(uc.executeCrossComponent({ features: [] })).rejects.toThrow(
        'features array must not be empty'
      );
    });

    it('throws ValidationError when cross-component batch exceeds 50', async () => {
      const deps = buildDeps([]);
      const uc = new BatchUploadFeatures(deps);

      const features = Array.from({ length: 51 }, (_, i) => ({
        node_id: `comp-${i}`,
        version: 'v1',
        filename: `f-${i}.feature`,
        content: `Feature: F${i}\n  Scenario: S\n    Given a step`,
      }));

      await expect(uc.executeCrossComponent({ features })).rejects.toThrow('maximum 50');
    });

    it('returns error for invalid entry on existing cross-component node', async () => {
      const nodes = [
        new Node({ id: 'cross-1', name: 'Cross 1', type: 'component', layer: 'layer-1' }),
      ];
      const deps = buildDeps(nodes);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.executeCrossComponent({
        features: [
          {
            node_id: 'cross-1',
            version: 'v1',
            filename: 'valid.feature',
            content: 'not valid gherkin',
          },
        ],
      });

      expect(result.uploaded).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Invalid Gherkin');
    });

    it('returns error for entry with empty content', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.execute({
        nodeId: 'comp-1',
        version: 'v1',
        features: [
          {
            filename: 'empty.feature',
            content: '',
          },
        ],
      });

      expect(result.uploaded).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('content is required');
    });
  });

  describe('filename security', () => {
    it('rejects filenames with path traversal (..)', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.execute({
        nodeId: 'comp-1',
        version: 'v1',
        features: [
          {
            filename: '../etc/passwd.feature',
            content: 'Feature: Evil\n  Scenario: S\n    Given a step',
          },
        ],
      });

      expect(result.uploaded).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('unsafe characters');
    });

    it('rejects filenames with forward slash', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.execute({
        nodeId: 'comp-1',
        version: 'v1',
        features: [
          {
            filename: 'path/to/file.feature',
            content: 'Feature: Slash\n  Scenario: S\n    Given a step',
          },
        ],
      });

      expect(result.uploaded).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('unsafe characters');
    });

    it('rejects filenames with backslash', async () => {
      const node = new Node({ id: 'comp-1', name: 'Comp 1', type: 'component', layer: 'layer-1' });
      const deps = buildDeps([node]);
      const uc = new BatchUploadFeatures(deps);

      const result = await uc.execute({
        nodeId: 'comp-1',
        version: 'v1',
        features: [
          {
            filename: 'path\\to\\file.feature',
            content: 'Feature: Backslash\n  Scenario: S\n    Given a step',
          },
        ],
      });

      expect(result.uploaded).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('unsafe characters');
    });
  });
});
