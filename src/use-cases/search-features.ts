import type { IFeatureRepository } from '../domain/index.js';

import { ValidationError } from '../domain/errors.js';

interface Deps {
  featureRepo: IFeatureRepository;
}

export interface SearchResult {
  node_id: string;
  filename: string;
  version: string;
  title: string;
  step_count: number;
  snippet: string;
}

const SNIPPET_RADIUS = 50;

function extractSnippet(content: string, lowerQuery: string): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(lowerQuery);
  if (idx === -1) {
    return content.slice(0, SNIPPET_RADIUS * 2).trim();
  }
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(content.length, idx + lowerQuery.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

/**
 * SearchFeatures use case.
 *
 * Searches feature file content across all components and returns
 * matching results with contextual snippets. The full content field
 * is excluded from results to keep payloads small.
 */
export class SearchFeatures {
  private readonly featureRepo: IFeatureRepository;

  constructor({ featureRepo }: Deps) {
    this.featureRepo = featureRepo;
  }

  async execute(query: string, version?: string, limit?: number): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new ValidationError('Search query must not be empty');
    }
    const features = await this.featureRepo.search(trimmed, version, limit);
    const lowerQuery = trimmed.toLowerCase();
    return features.map(f => ({
      node_id: f.node_id,
      filename: f.filename,
      version: f.version,
      title: f.title,
      step_count: f.step_count,
      snippet: extractSnippet(f.content ?? '', lowerQuery),
    }));
  }
}
