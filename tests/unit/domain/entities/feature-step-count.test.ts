import { describe, expect, it } from 'vitest';

import { Feature } from '../../../../src/domain/entities/feature.js';

describe('Feature — step_count property', () => {
  it('defaults step_count to 0 when not provided', () => {
    const feat = new Feature({
      node_id: 'comp-1',
      version: 'mvp',
      filename: 'mvp-test.feature',
      title: 'Test',
    });
    expect(feat.step_count).toBe(0);
  });

  it('accepts an explicit step_count', () => {
    const feat = new Feature({
      node_id: 'comp-1',
      version: 'v1',
      filename: 'v1-auth.feature',
      title: 'Auth',
      step_count: 12,
    });
    expect(feat.step_count).toBe(12);
  });

  it('includes step_count in toJSON output', () => {
    const feat = new Feature({
      id: 1,
      node_id: 'comp-1',
      version: 'v1',
      filename: 'v1-auth.feature',
      title: 'Auth',
      step_count: 7,
      content: 'Feature: Auth',
      updated_at: '2025-01-01',
    });
    const json = feat.toJSON();
    expect(json).toHaveProperty('step_count', 7);
  });

  it('treats null step_count as 0', () => {
    const feat = new Feature({
      node_id: 'comp-1',
      version: 'v1',
      filename: 'v1-test.feature',
      title: 'Test',
      step_count: null as unknown as number,
    });
    expect(feat.step_count).toBe(0);
  });
});
