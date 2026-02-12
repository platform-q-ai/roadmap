import type { Feature, IFeatureRepository } from '@domain/index.js';
import { SearchFeatures } from '@use-cases/index.js';
import { describe, expect, it, vi } from 'vitest';

function makeMockFeature(overrides: {
  node_id: string;
  version: string;
  filename: string;
  content: string;
}): Feature {
  return {
    ...overrides,
    id: null,
    title: overrides.filename,
    step_count: 1,
    updated_at: null,
    toJSON: vi.fn().mockReturnValue(overrides),
  } as unknown as Feature;
}

function buildMockRepo(features: Feature[]) {
  const featureRepo: Pick<IFeatureRepository, 'search'> = {
    search: vi.fn(async (query: string, version?: string, _limit?: number) => {
      const lower = query.toLowerCase();
      return features.filter(f => {
        const match = (f.content ?? '').toLowerCase().includes(lower);
        if (version) {
          return match && f.version === version;
        }
        return match;
      });
    }),
  };
  return { featureRepo: featureRepo as IFeatureRepository };
}

describe('SearchFeatures use case', () => {
  it('returns matching features with snippets', async () => {
    const feat = makeMockFeature({
      node_id: 'comp-a',
      version: 'v1',
      filename: 'auth.feature',
      content: 'Feature: Auth\n  Scenario: Login\n    Given authentication is enabled',
    });
    const repos = buildMockRepo([feat]);
    const uc = new SearchFeatures(repos);
    const results = await uc.execute('authentication');
    expect(results).toHaveLength(1);
    expect(results[0].node_id).toBe('comp-a');
    expect(results[0].snippet).toBeDefined();
    expect(typeof results[0].snippet).toBe('string');
  });

  it('returns empty array when no features match', async () => {
    const repos = buildMockRepo([]);
    const uc = new SearchFeatures(repos);
    const results = await uc.execute('nonexistent');
    expect(results).toHaveLength(0);
  });

  it('filters by version when provided', async () => {
    const f1 = makeMockFeature({
      node_id: 'comp-a',
      version: 'v1',
      filename: 'v1-test.feature',
      content: 'Feature: Test v1\n  Scenario: S\n    Given test setup',
    });
    const f2 = makeMockFeature({
      node_id: 'comp-a',
      version: 'mvp',
      filename: 'mvp-test.feature',
      content: 'Feature: Test mvp\n  Scenario: S\n    Given test setup',
    });
    const repos = buildMockRepo([f1, f2]);
    const uc = new SearchFeatures(repos);
    const results = await uc.execute('test', 'v1');
    expect(results).toHaveLength(1);
    expect(results[0].version).toBe('v1');
  });

  it('generates snippet showing context around the match', async () => {
    const longContent =
      'Feature: Long content\n' +
      '  This is a long description that eventually mentions rate limiting in the middle ' +
      'followed by more text after the keyword appears in the content';
    const feat = makeMockFeature({
      node_id: 'comp-a',
      version: 'v1',
      filename: 'rates.feature',
      content: longContent,
    });
    const repos = buildMockRepo([feat]);
    const uc = new SearchFeatures(repos);
    const results = await uc.execute('rate limiting');
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toContain('rate limiting');
  });

  it('excludes the full content field from results', async () => {
    const feat = makeMockFeature({
      node_id: 'comp-a',
      version: 'v1',
      filename: 'auth.feature',
      content: 'Feature: Auth\n  Scenario: S\n    Given authentication works',
    });
    const repos = buildMockRepo([feat]);
    const uc = new SearchFeatures(repos);
    const results = await uc.execute('authentication');
    expect(results).toHaveLength(1);
    expect('content' in results[0]).toBe(false);
  });

  it('throws ValidationError when query is empty', async () => {
    const repos = buildMockRepo([]);
    const uc = new SearchFeatures(repos);
    await expect(uc.execute('')).rejects.toThrow(/query/i);
  });

  it('handles null content gracefully', async () => {
    const feat = makeMockFeature({
      node_id: 'comp-a',
      version: 'v1',
      filename: 'null.feature',
      content: '',
    });
    // Override content to null
    Object.defineProperty(feat, 'content', { value: null });
    const repos = buildMockRepo([feat]);
    // Force repo to return the feature even though content is null
    repos.featureRepo.search = vi.fn(async () => [feat]);
    const uc = new SearchFeatures(repos);
    const results = await uc.execute('anything');
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toBe('');
  });

  it('snippet has no ellipsis when content is short', async () => {
    const feat = makeMockFeature({
      node_id: 'comp-a',
      version: 'v1',
      filename: 'short.feature',
      content: 'Feature: Short test',
    });
    const repos = buildMockRepo([feat]);
    const uc = new SearchFeatures(repos);
    const results = await uc.execute('Short');
    expect(results).toHaveLength(1);
    expect(results[0].snippet).not.toContain('...');
  });

  it('includes required fields in each result', async () => {
    const feat = makeMockFeature({
      node_id: 'comp-a',
      version: 'v1',
      filename: 'auth.feature',
      content: 'Feature: Auth\n  Scenario: S\n    Given authentication works',
    });
    const repos = buildMockRepo([feat]);
    const uc = new SearchFeatures(repos);
    const results = await uc.execute('authentication');
    const result = results[0];
    expect(result).toHaveProperty('node_id');
    expect(result).toHaveProperty('filename');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('step_count');
    expect(result).toHaveProperty('snippet');
  });
});
