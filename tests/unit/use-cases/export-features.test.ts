import type { Feature, IFeatureRepository } from '@domain/index.js';
import { describe, expect, it, vi } from 'vitest';

/* ──────────────────────────────────────────────────────────────────
 * Unit tests for ExportFeatures use case.
 *
 * The use case reads features from the repo and writes them back
 * to the filesystem via injected I/O functions.
 * ────────────────────────────────────────────────────────────────── */

function makeFeature(overrides: {
  node_id: string;
  version: string;
  filename: string;
  content?: string;
}): Feature {
  return {
    ...overrides,
    id: null,
    title: overrides.filename,
    content: overrides.content ?? 'Feature: X\n  Scenario: S\n    Given a step',
    step_count: 1,
    updated_at: null,
    toJSON: vi.fn(),
  } as unknown as Feature;
}

describe('ExportFeatures use case', () => {
  it('exports all features to the filesystem', async () => {
    const { ExportFeatures } = await import('@use-cases/export-features.js');
    const features = [
      makeFeature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'v1-test.feature',
      }),
      makeFeature({
        node_id: 'comp-b',
        version: 'mvp',
        filename: 'mvp-test.feature',
      }),
    ];
    const featureRepo = {
      findAll: vi.fn(async () => features),
      findByNode: vi.fn(async (nid: string) => features.filter(f => f.node_id === nid)),
    } as unknown as IFeatureRepository;
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const buildDir = (nodeId: string) => `components/${nodeId}/features`;
    const uc = new ExportFeatures({
      featureRepo,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
      buildDir,
    });
    const result = await uc.execute();
    expect(result.exported).toBe(2);
    expect(writeFn).toHaveBeenCalledTimes(2);
    expect(ensureDirFn).toHaveBeenCalled();
  });

  it('filters by component when specified', async () => {
    const { ExportFeatures } = await import('@use-cases/export-features.js');
    const features = [
      makeFeature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'v1-a.feature',
      }),
    ];
    const featureRepo = {
      findAll: vi.fn(async () => []),
      findByNode: vi.fn(async () => features),
    } as unknown as IFeatureRepository;
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const buildDir = (nodeId: string) => `components/${nodeId}/features`;
    const uc = new ExportFeatures({
      featureRepo,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
      buildDir,
    });
    const result = await uc.execute('comp-a');
    expect(result.exported).toBe(1);
    expect(featureRepo.findByNode).toHaveBeenCalledWith('comp-a');
  });

  it('creates directories for each component', async () => {
    const { ExportFeatures } = await import('@use-cases/export-features.js');
    const features = [
      makeFeature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'v1-test.feature',
      }),
    ];
    const featureRepo = {
      findAll: vi.fn(async () => features),
      findByNode: vi.fn(async () => []),
    } as unknown as IFeatureRepository;
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const buildDir = (nodeId: string) => `components/${nodeId}/features`;
    const uc = new ExportFeatures({
      featureRepo,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
      buildDir,
    });
    await uc.execute();
    expect(ensureDirFn).toHaveBeenCalledWith('components/comp-a/features');
  });

  it('writes correct content for each feature', async () => {
    const { ExportFeatures } = await import('@use-cases/export-features.js');
    const content = 'Feature: Test\n  Scenario: S\n    Given step';
    const features = [
      makeFeature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'v1-test.feature',
        content,
      }),
    ];
    const featureRepo = {
      findAll: vi.fn(async () => features),
      findByNode: vi.fn(async () => []),
    } as unknown as IFeatureRepository;
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const buildDir = (nodeId: string) => `components/${nodeId}/features`;
    const uc = new ExportFeatures({
      featureRepo,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
      buildDir,
    });
    await uc.execute();
    expect(writeFn).toHaveBeenCalledWith('components/comp-a/features', 'v1-test.feature', content);
  });

  it('returns zero when no features exist', async () => {
    const { ExportFeatures } = await import('@use-cases/export-features.js');
    const featureRepo = {
      findAll: vi.fn(async () => []),
      findByNode: vi.fn(async () => []),
    } as unknown as IFeatureRepository;
    const writeFn = vi.fn(async () => {});
    const ensureDirFn = vi.fn(async () => {});
    const buildDir = (nodeId: string) => `components/${nodeId}/features`;
    const uc = new ExportFeatures({
      featureRepo,
      writeFeatureFile: writeFn,
      ensureDir: ensureDirFn,
      buildDir,
    });
    const result = await uc.execute();
    expect(result.exported).toBe(0);
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('rejects invalid component parameter', async () => {
    const { ExportFeatures } = await import('@use-cases/export-features.js');
    const featureRepo = {
      findAll: vi.fn(async () => []),
      findByNode: vi.fn(async () => []),
    } as unknown as IFeatureRepository;
    const buildDir = (nodeId: string) => `components/${nodeId}/features`;
    const uc = new ExportFeatures({
      featureRepo,
      writeFeatureFile: vi.fn(async () => {}),
      ensureDir: vi.fn(async () => {}),
      buildDir,
    });
    await expect(uc.execute('INVALID COMP')).rejects.toThrow(/Invalid component/);
  });

  it('skips features with path-unsafe node_id or filename', async () => {
    const { ExportFeatures } = await import('@use-cases/export-features.js');
    const features = [
      makeFeature({
        node_id: '../evil',
        version: 'v1',
        filename: 'v1-test.feature',
      }),
      makeFeature({
        node_id: 'comp-a',
        version: 'v1',
        filename: '../../etc/passwd',
      }),
      makeFeature({
        node_id: 'comp-a',
        version: 'v1',
        filename: 'v1-safe.feature',
      }),
    ];
    const featureRepo = {
      findAll: vi.fn(async () => features),
      findByNode: vi.fn(async () => []),
    } as unknown as IFeatureRepository;
    const writeFn = vi.fn(async () => {});
    const buildDir = (nodeId: string) => `components/${nodeId}/features`;
    const uc = new ExportFeatures({
      featureRepo,
      writeFeatureFile: writeFn,
      ensureDir: vi.fn(async () => {}),
      buildDir,
    });
    const result = await uc.execute();
    expect(result.exported).toBe(1);
    expect(writeFn).toHaveBeenCalledTimes(1);
  });
});
