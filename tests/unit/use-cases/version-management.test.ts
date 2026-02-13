import type { IFeatureRepository, INodeRepository, IVersionRepository } from '@domain/index.js';
import { Version } from '@domain/index.js';
import { DeleteAllVersions, GetVersion, ListVersions } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

// ─── Mock repos ─────────────────────────────────────────────────────

interface MockOpts {
  nodeExists?: boolean;
  versions?: Version[];
  singleVersion?: Version | null;
  stepSummary?: { totalSteps: number; featureCount: number };
}

function buildMocks(opts: MockOpts = {}) {
  const nodeRepo: Pick<INodeRepository, 'exists'> = {
    exists: vi.fn(async () => opts.nodeExists ?? true),
  };
  const versionRepo: Pick<
    IVersionRepository,
    'findByNode' | 'findByNodeAndVersion' | 'deleteByNode'
  > = {
    findByNode: vi.fn(async () => opts.versions ?? []),
    findByNodeAndVersion: vi.fn(async () => opts.singleVersion ?? null),
    deleteByNode: vi.fn(async () => undefined),
  };
  const featureRepo: Pick<IFeatureRepository, 'getStepCountSummary'> = {
    getStepCountSummary: vi.fn(async () => opts.stepSummary ?? { totalSteps: 0, featureCount: 0 }),
  };
  return {
    nodeRepo: nodeRepo as INodeRepository,
    versionRepo: versionRepo as IVersionRepository,
    featureRepo: featureRepo as IFeatureRepository,
  };
}

// ─── ListVersions ───────────────────────────────────────────────────

describe('ListVersions use case', () => {
  it('returns all versions for a component', async () => {
    const versions = [
      new Version({ node_id: 'comp-a', version: 'overview', content: 'Overview' }),
      new Version({ node_id: 'comp-a', version: 'mvp', progress: 50, status: 'in-progress' }),
      new Version({ node_id: 'comp-a', version: 'v1', progress: 0, status: 'planned' }),
    ];
    const repos = buildMocks({ nodeExists: true, versions });
    const uc = new ListVersions(repos);
    const result = await uc.execute('comp-a');
    expect(result).toHaveLength(3);
    expect(result[0].version).toBe('overview');
  });

  it('enriches phase versions with step-based progress', async () => {
    const versions = [
      new Version({ node_id: 'comp-a', version: 'mvp', progress: 50, status: 'in-progress' }),
    ];
    const repos = buildMocks({
      nodeExists: true,
      versions,
      stepSummary: { totalSteps: 20, featureCount: 3 },
    });
    const uc = new ListVersions(repos);
    const result = await uc.execute('comp-a');
    expect(result).toHaveLength(1);
    expect(result[0].total_steps).toBe(20);
    expect(result[0]).toHaveProperty('passing_steps');
    expect(result[0]).toHaveProperty('step_progress');
  });

  it('does not add step fields to non-phase versions', async () => {
    const versions = [
      new Version({ node_id: 'comp-a', version: 'overview', content: 'Overview text' }),
    ];
    const repos = buildMocks({ nodeExists: true, versions });
    const uc = new ListVersions(repos);
    const result = await uc.execute('comp-a');
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('total_steps');
    expect(result[0]).not.toHaveProperty('passing_steps');
  });

  it('throws NodeNotFoundError when component does not exist', async () => {
    const repos = buildMocks({ nodeExists: false });
    const uc = new ListVersions(repos);
    await expect(uc.execute('ghost')).rejects.toThrow(/not found/i);
  });
});

// ─── GetVersion ─────────────────────────────────────────────────────

describe('GetVersion use case', () => {
  it('returns a single version with step-based progress', async () => {
    const ver = new Version({
      node_id: 'comp-a',
      version: 'v1',
      content: 'V1 content',
      progress: 30,
      status: 'in-progress',
    });
    const repos = buildMocks({
      nodeExists: true,
      singleVersion: ver,
      stepSummary: { totalSteps: 40, featureCount: 5 },
    });
    const uc = new GetVersion(repos);
    const result = await uc.execute('comp-a', 'v1');
    expect(result.version).toBe('v1');
    expect(result.total_steps).toBe(40);
    expect(result).toHaveProperty('passing_steps');
    expect(result).toHaveProperty('step_progress');
  });

  it('returns overview version without step fields', async () => {
    const ver = new Version({
      node_id: 'comp-a',
      version: 'overview',
      content: 'Overview',
    });
    const repos = buildMocks({ nodeExists: true, singleVersion: ver });
    const uc = new GetVersion(repos);
    const result = await uc.execute('comp-a', 'overview');
    expect(result.version).toBe('overview');
    expect(result).not.toHaveProperty('total_steps');
  });

  it('throws NodeNotFoundError when component does not exist', async () => {
    const repos = buildMocks({ nodeExists: false });
    const uc = new GetVersion(repos);
    await expect(uc.execute('ghost', 'mvp')).rejects.toThrow(/not found/i);
  });

  it('throws VersionNotFoundError when version does not exist', async () => {
    const repos = buildMocks({ nodeExists: true, singleVersion: null });
    const uc = new GetVersion(repos);
    await expect(uc.execute('comp-a', 'v99')).rejects.toThrow(/not found/i);
  });
});

// ─── DeleteAllVersions ──────────────────────────────────────────────

describe('DeleteAllVersions use case', () => {
  it('deletes all versions for a component', async () => {
    const repos = buildMocks({ nodeExists: true });
    const uc = new DeleteAllVersions(repos);
    await uc.execute('comp-a');
    expect(repos.versionRepo.deleteByNode).toHaveBeenCalledWith('comp-a');
  });

  it('throws NodeNotFoundError when component does not exist', async () => {
    const repos = buildMocks({ nodeExists: false });
    const uc = new DeleteAllVersions(repos);
    await expect(uc.execute('ghost')).rejects.toThrow(/not found/i);
  });
});
