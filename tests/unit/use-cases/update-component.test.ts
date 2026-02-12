import type { INodeRepository, IVersionRepository } from '@domain/index.js';
import { Node, Version } from '@domain/index.js';
import { UpdateComponent } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function createMockRepos(existingNode?: Node, existingVersions: Version[] = []) {
  let savedNode: Node | null = null;
  const savedVersions: Version[] = [];

  const nodeRepo: INodeRepository = {
    findAll: vi.fn(),
    findById: vi.fn().mockImplementation(async (id: string) => {
      if (savedNode && savedNode.id === id) {
        return savedNode;
      }
      if (existingNode && existingNode.id === id) {
        return existingNode;
      }
      return null;
    }),
    findByType: vi.fn(),
    findByLayer: vi.fn(),
    exists: vi.fn(),
    save: vi.fn().mockImplementation(async (node: Node) => {
      savedNode = node;
    }),
    delete: vi.fn(),
  };

  const versionRepo: IVersionRepository = {
    findAll: vi.fn(),
    findByNode: vi
      .fn()
      .mockImplementation(async (nid: string) => existingVersions.filter(v => v.node_id === nid)),
    findByNodeAndVersion: vi.fn(),
    save: vi.fn().mockImplementation(async (version: Version) => {
      savedVersions.push(version);
    }),
    deleteByNode: vi.fn(),
  };

  return { nodeRepo, versionRepo, getSavedNode: () => savedNode, savedVersions };
}

const baseNode = new Node({
  id: 'comp-a',
  name: 'Component A',
  type: 'component',
  layer: 'supervisor-layer',
  description: 'Original description',
  tags: ['old-tag'],
  sort_order: 5,
  current_version: null,
});

describe('UpdateComponent', () => {
  it('updates the name of an existing component', async () => {
    const { nodeRepo, versionRepo, getSavedNode } = createMockRepos(baseNode);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    const result = await uc.execute('comp-a', { name: 'New Name' });

    expect(result.name).toBe('New Name');
    expect(getSavedNode()?.name).toBe('New Name');
  });

  it('updates the description of an existing component', async () => {
    const { nodeRepo, versionRepo, getSavedNode } = createMockRepos(baseNode);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    const result = await uc.execute('comp-a', { description: 'Updated desc' });

    expect(result.description).toBe('Updated desc');
    expect(getSavedNode()?.description).toBe('Updated desc');
  });

  it('updates tags of an existing component', async () => {
    const { nodeRepo, versionRepo, getSavedNode } = createMockRepos(baseNode);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    const result = await uc.execute('comp-a', { tags: ['new', 'updated'] });

    expect(result.tags).toEqual(['new', 'updated']);
    expect(getSavedNode()?.tags).toEqual(['new', 'updated']);
  });

  it('updates sort_order of an existing component', async () => {
    const { nodeRepo, versionRepo, getSavedNode } = createMockRepos(baseNode);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    const result = await uc.execute('comp-a', { sort_order: 99 });

    expect(result.sort_order).toBe(99);
    expect(getSavedNode()?.sort_order).toBe(99);
  });

  it('updates current_version of an existing component', async () => {
    const { nodeRepo, versionRepo, getSavedNode } = createMockRepos(baseNode);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    const result = await uc.execute('comp-a', { current_version: '0.5.0' });

    expect(result.current_version).toBe('0.5.0');
    expect(getSavedNode()?.current_version).toBe('0.5.0');
  });

  it('preserves unmodified fields', async () => {
    const { nodeRepo, versionRepo, getSavedNode } = createMockRepos(baseNode);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    await uc.execute('comp-a', { name: 'Changed' });

    const saved = getSavedNode();
    expect(saved?.id).toBe('comp-a');
    expect(saved?.type).toBe('component');
    expect(saved?.layer).toBe('supervisor-layer');
    expect(saved?.description).toBe('Original description');
    expect(saved?.tags).toEqual(['old-tag']);
    expect(saved?.sort_order).toBe(5);
  });

  it('throws NodeNotFoundError for nonexistent component', async () => {
    const { nodeRepo, versionRepo } = createMockRepos();
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    await expect(uc.execute('ghost', { name: 'Ghost' })).rejects.toThrow('not found');
  });

  it('throws ValidationError for invalid current_version format', async () => {
    const { nodeRepo, versionRepo } = createMockRepos(baseNode);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    await expect(uc.execute('comp-a', { current_version: 'not-semver' })).rejects.toThrow(
      /version/i
    );
  });

  it('recalculates version progress when current_version changes', async () => {
    const mvpVersion = new Version({
      node_id: 'comp-a',
      version: 'mvp',
      content: 'mvp content',
      progress: 0,
      status: 'planned',
    });
    const { nodeRepo, versionRepo, savedVersions } = createMockRepos(baseNode, [mvpVersion]);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    await uc.execute('comp-a', { current_version: '0.7.5' });

    expect(savedVersions.length).toBeGreaterThan(0);
    const updatedMvp = savedVersions.find(v => v.version === 'mvp');
    expect(updatedMvp).toBeDefined();
    expect(updatedMvp?.progress).toBe(75);
  });

  it('updates multiple fields at once', async () => {
    const { nodeRepo, versionRepo, getSavedNode } = createMockRepos(baseNode);
    const uc = new UpdateComponent({ nodeRepo, versionRepo });

    const result = await uc.execute('comp-a', {
      name: 'Multi Update',
      description: 'New desc',
      tags: ['a', 'b'],
    });

    expect(result.name).toBe('Multi Update');
    expect(result.description).toBe('New desc');
    expect(result.tags).toEqual(['a', 'b']);
    expect(getSavedNode()?.name).toBe('Multi Update');
  });
});
