import type { INodeRepository, IVersionRepository } from '@domain/index.js';
import { Version } from '@domain/index.js';
import { UpdateVersion } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function buildMockRepos(opts: { nodeExists?: boolean; existingVersion?: Version | null }) {
  const nodeRepo: Pick<INodeRepository, 'exists'> = {
    exists: vi.fn(async () => opts.nodeExists ?? true),
  };
  const versionRepo: Pick<IVersionRepository, 'findByNodeAndVersion' | 'save'> = {
    findByNodeAndVersion: vi.fn(async () => opts.existingVersion ?? null),
    save: vi.fn(async () => undefined),
  };
  return {
    nodeRepo: nodeRepo as INodeRepository,
    versionRepo: versionRepo as IVersionRepository,
  };
}

describe('UpdateVersion use case', () => {
  it('updates content for an existing version', async () => {
    const existing = new Version({
      node_id: 'comp-a',
      version: 'mvp',
      content: 'Old content',
      progress: 0,
      status: 'planned',
    });
    const repos = buildMockRepos({ nodeExists: true, existingVersion: existing });
    const uc = new UpdateVersion(repos);
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'mvp',
      content: 'New content',
    });
    expect(result.content).toBe('New content');
    expect(result.node_id).toBe('comp-a');
    expect(result.version).toBe('mvp');
    expect(repos.versionRepo.save).toHaveBeenCalled();
  });

  it('updates progress and status alongside content', async () => {
    const existing = new Version({
      node_id: 'comp-a',
      version: 'mvp',
      content: 'Old',
      progress: 0,
      status: 'planned',
    });
    const repos = buildMockRepos({ nodeExists: true, existingVersion: existing });
    const uc = new UpdateVersion(repos);
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'mvp',
      content: 'In progress now',
      progress: 50,
      status: 'in-progress',
    });
    expect(result.progress).toBe(50);
    expect(result.status).toBe('in-progress');
  });

  it('preserves existing progress/status when not provided', async () => {
    const existing = new Version({
      node_id: 'comp-a',
      version: 'v1',
      content: 'Old',
      progress: 30,
      status: 'in-progress',
    });
    const repos = buildMockRepos({ nodeExists: true, existingVersion: existing });
    const uc = new UpdateVersion(repos);
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v1',
      content: 'Updated content only',
    });
    expect(result.content).toBe('Updated content only');
    expect(result.progress).toBe(30);
    expect(result.status).toBe('in-progress');
  });

  it('throws when the component does not exist', async () => {
    const repos = buildMockRepos({ nodeExists: false });
    const uc = new UpdateVersion(repos);
    await expect(uc.execute({ nodeId: 'ghost', version: 'mvp', content: 'Nope' })).rejects.toThrow(
      /not found/i
    );
  });

  it('creates version if it does not exist yet', async () => {
    const repos = buildMockRepos({ nodeExists: true, existingVersion: null });
    const uc = new UpdateVersion(repos);
    const result = await uc.execute({
      nodeId: 'comp-a',
      version: 'v2',
      content: 'Brand new',
    });
    expect(result.content).toBe('Brand new');
    expect(result.version).toBe('v2');
    expect(repos.versionRepo.save).toHaveBeenCalled();
  });

  it('rejects progress outside 0-100', async () => {
    const existing = new Version({
      node_id: 'comp-a',
      version: 'mvp',
      content: 'Old',
    });
    const repos = buildMockRepos({ nodeExists: true, existingVersion: existing });
    const uc = new UpdateVersion(repos);
    await expect(
      uc.execute({ nodeId: 'comp-a', version: 'mvp', content: 'X', progress: 150 })
    ).rejects.toThrow(/progress/i);
  });

  it('rejects invalid status value', async () => {
    const existing = new Version({
      node_id: 'comp-a',
      version: 'mvp',
      content: 'Old',
    });
    const repos = buildMockRepos({ nodeExists: true, existingVersion: existing });
    const uc = new UpdateVersion(repos);
    await expect(
      uc.execute({
        nodeId: 'comp-a',
        version: 'mvp',
        content: 'X',
        status: 'invalid' as 'planned',
      })
    ).rejects.toThrow(/status/i);
  });

  it('rejects empty content', async () => {
    const existing = new Version({
      node_id: 'comp-a',
      version: 'mvp',
      content: 'Old',
    });
    const repos = buildMockRepos({ nodeExists: true, existingVersion: existing });
    const uc = new UpdateVersion(repos);
    await expect(uc.execute({ nodeId: 'comp-a', version: 'mvp' })).rejects.toThrow(/content/i);
  });
});
