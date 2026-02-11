import { Version } from '@domain/entities/version.js';
import { describe, expect, it } from 'vitest';

describe('Version.deriveProgress', () => {
  describe('MVP phase (major 0)', () => {
    it('returns minor * 10 for major 0', () => {
      expect(Version.deriveProgress('0.5.0', 'mvp')).toBe(50);
    });

    it('returns 0 for version 0.0.0', () => {
      expect(Version.deriveProgress('0.0.0', 'mvp')).toBe(0);
    });

    it('returns 90 for version 0.9.0', () => {
      expect(Version.deriveProgress('0.9.0', 'mvp')).toBe(90);
    });

    it('returns 100 once major reaches 1', () => {
      expect(Version.deriveProgress('1.0.0', 'mvp')).toBe(100);
    });

    it('returns 100 for major > 1', () => {
      expect(Version.deriveProgress('2.3.0', 'mvp')).toBe(100);
      expect(Version.deriveProgress('3.0.0', 'mvp')).toBe(100);
    });
  });

  describe('v1 phase (major 1)', () => {
    it('returns minor * 10 for major 1', () => {
      expect(Version.deriveProgress('1.3.0', 'v1')).toBe(30);
    });

    it('returns 0 when still in MVP phase', () => {
      expect(Version.deriveProgress('0.8.0', 'v1')).toBe(0);
    });

    it('returns 100 once major reaches 2', () => {
      expect(Version.deriveProgress('2.0.0', 'v1')).toBe(100);
    });

    it('returns 100 for major > 2', () => {
      expect(Version.deriveProgress('3.0.0', 'v1')).toBe(100);
    });
  });

  describe('v2 phase (major 2)', () => {
    it('returns minor * 10 for major 2', () => {
      expect(Version.deriveProgress('2.7.0', 'v2')).toBe(70);
    });

    it('returns 0 when still in v1 phase', () => {
      expect(Version.deriveProgress('1.5.0', 'v2')).toBe(0);
    });

    it('returns 100 once major reaches 3', () => {
      expect(Version.deriveProgress('3.0.0', 'v2')).toBe(100);
    });
  });

  describe('null current_version', () => {
    it('returns 0 for all phases', () => {
      expect(Version.deriveProgress(null, 'mvp')).toBe(0);
      expect(Version.deriveProgress(null, 'v1')).toBe(0);
      expect(Version.deriveProgress(null, 'v2')).toBe(0);
    });
  });

  describe('overview version tag', () => {
    it('returns 0 for overview regardless of current_version', () => {
      expect(Version.deriveProgress('1.5.0', 'overview')).toBe(0);
      expect(Version.deriveProgress('2.0.0', 'overview')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('clamps progress to 100 maximum', () => {
      // Even if somehow a version had minor > 10, progress should not exceed 100
      expect(Version.deriveProgress('0.5.0', 'mvp')).toBeLessThanOrEqual(100);
    });

    it('returns 0 for unrecognised version tags', () => {
      expect(Version.deriveProgress('1.5.0', 'v3')).toBe(0);
    });
  });
});

describe('Version.deriveStatus', () => {
  it('returns planned for progress 0', () => {
    expect(Version.deriveStatus(0)).toBe('planned');
  });

  it('returns in-progress for progress between 1 and 99', () => {
    expect(Version.deriveStatus(1)).toBe('in-progress');
    expect(Version.deriveStatus(50)).toBe('in-progress');
    expect(Version.deriveStatus(99)).toBe('in-progress');
  });

  it('returns complete for progress 100', () => {
    expect(Version.deriveStatus(100)).toBe('complete');
  });
});
