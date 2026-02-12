import { Feature } from '@domain/entities/feature.js';
import { describe, expect, it } from 'vitest';

describe('Feature Entity', () => {
  it('creates with required fields and defaults', () => {
    const feat = new Feature({
      node_id: 'worker',
      version: 'mvp',
      filename: 'mvp-exec.feature',
      title: 'Task Execution',
    });
    expect(feat.node_id).toBe('worker');
    expect(feat.version).toBe('mvp');
    expect(feat.filename).toBe('mvp-exec.feature');
    expect(feat.title).toBe('Task Execution');
    expect(feat.id).toBeNull();
    expect(feat.content).toBeNull();
    expect(feat.updated_at).toBeNull();
  });

  it('accepts all fields explicitly', () => {
    const feat = new Feature({
      id: 5,
      node_id: 'w',
      version: 'v1',
      filename: 'v1-tools.feature',
      title: 'Advanced Tools',
      content: 'Feature: Advanced Tools',
      updated_at: '2025-01-01',
    });
    expect(feat.id).toBe(5);
    expect(feat.content).toBe('Feature: Advanced Tools');
    expect(feat.updated_at).toBe('2025-01-01');
  });

  describe('versionFromFilename', () => {
    it('returns mvp for mvp- prefix', () => {
      expect(Feature.versionFromFilename('mvp-basic.feature')).toBe('mvp');
    });

    it('returns v1 for v1- prefix', () => {
      expect(Feature.versionFromFilename('v1-advanced.feature')).toBe('v1');
    });

    it('returns v2 for v2- prefix', () => {
      expect(Feature.versionFromFilename('v2-future.feature')).toBe('v2');
    });

    it('defaults to mvp when no recognized prefix', () => {
      expect(Feature.versionFromFilename('some-feature.feature')).toBe('mvp');
    });
  });

  describe('titleFromContent', () => {
    it('extracts title from Feature: line', () => {
      const content = 'Feature: My Cool Feature\n  Scenario: test';
      expect(Feature.titleFromContent(content, 'fallback.feature')).toBe('My Cool Feature');
    });

    it('falls back to filename without extension when no Feature line', () => {
      const content = 'No feature line here';
      expect(Feature.titleFromContent(content, 'fallback.feature')).toBe('fallback');
    });

    it('trims whitespace from extracted title', () => {
      const content = 'Feature:   Spaced Title   \n  Scenario: test';
      expect(Feature.titleFromContent(content, 'fb.feature')).toBe('Spaced Title');
    });
  });

  it('produces a plain JSON representation', () => {
    const feat = new Feature({
      id: 1,
      node_id: 'n',
      version: 'mvp',
      filename: 'mvp-test.feature',
      title: 'Test',
      content: 'Feature: Test',
      updated_at: '2025-01-01',
    });
    expect(feat.toJSON()).toEqual({
      id: 1,
      node_id: 'n',
      version: 'mvp',
      filename: 'mvp-test.feature',
      title: 'Test',
      content: 'Feature: Test',
      step_count: 0,
      updated_at: '2025-01-01',
    });
  });
});
