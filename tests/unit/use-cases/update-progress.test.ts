import { Node } from '@domain/entities/node.js';
import type { INodeRepository } from '@domain/repositories/node-repository.js';
import type { IVersionRepository } from '@domain/repositories/version-repository.js';
import { UpdateProgress } from '@use-cases/update-progress.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(nodeExists: boolean) {
  const nodeRepo: INodeRepository = {
    findAll: vi.fn(),
    findById: vi
      .fn()
      .mockImplementation(async (id: string) =>
        nodeExists ? new Node({ id, name: id, type: 'component' }) : null
      ),
    findByType: vi.fn(),
    findByLayer: vi.fn(),
    exists: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const versionRepo: IVersionRepository = {
    findAll: vi.fn(),
    findByNode: vi.fn(),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn(),
    updateProgress: vi.fn(),
    deleteByNode: vi.fn(),
  };

  return { nodeRepo, versionRepo };
}

describe('UpdateProgress', () => {
  it('updates progress for an existing node', async () => {
    const repos = createMockRepos(true);
    const uc = new UpdateProgress(repos);

    await uc.execute('comp-1', 'mvp', 50, 'in-progress');

    expect(repos.versionRepo.updateProgress).toHaveBeenCalledWith(
      'comp-1',
      'mvp',
      50,
      'in-progress'
    );
  });

  it('throws for a nonexistent node', async () => {
    const repos = createMockRepos(false);
    const uc = new UpdateProgress(repos);

    await expect(uc.execute('ghost', 'mvp', 10, 'planned')).rejects.toThrow(
      'Node not found: ghost'
    );
  });

  it('throws for progress below zero', async () => {
    const repos = createMockRepos(true);
    const uc = new UpdateProgress(repos);

    await expect(uc.execute('comp', 'mvp', -5, 'planned')).rejects.toThrow(
      'Progress must be 0-100'
    );
  });

  it('throws for progress above one hundred', async () => {
    const repos = createMockRepos(true);
    const uc = new UpdateProgress(repos);

    await expect(uc.execute('comp', 'mvp', 150, 'planned')).rejects.toThrow(
      'Progress must be 0-100'
    );
  });

  it('accepts progress at boundary value 0', async () => {
    const repos = createMockRepos(true);
    const uc = new UpdateProgress(repos);

    await expect(uc.execute('comp', 'mvp', 0, 'planned')).resolves.toBeUndefined();
  });

  it('accepts progress at boundary value 100', async () => {
    const repos = createMockRepos(true);
    const uc = new UpdateProgress(repos);

    await expect(uc.execute('comp', 'mvp', 100, 'complete')).resolves.toBeUndefined();
  });

  it('throws for invalid status', async () => {
    const repos = createMockRepos(true);
    const uc = new UpdateProgress(repos);

    await expect(uc.execute('comp', 'mvp', 50, 'invalid-status' as 'planned')).rejects.toThrow(
      'Status must be one of'
    );
  });
});
