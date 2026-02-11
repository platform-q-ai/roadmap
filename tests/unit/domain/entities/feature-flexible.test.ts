import { describe, expect, it } from 'vitest';

import { Feature } from '../../../../src/domain/entities/feature.js';

describe('Feature — flexible version derivation', () => {
  it('should derive "v3" from v3-prefixed filename', () => {
    expect(Feature.versionFromFilename('v3-advanced.feature')).toBe('v3');
  });

  it('should derive "v4" from v4-prefixed filename', () => {
    expect(Feature.versionFromFilename('v4-future.feature')).toBe('v4');
  });

  it('should derive "v10" from v10-prefixed filename', () => {
    expect(Feature.versionFromFilename('v10-far-future.feature')).toBe('v10');
  });

  it('should still derive "v1" from v1-prefixed filename', () => {
    expect(Feature.versionFromFilename('v1-basic.feature')).toBe('v1');
  });

  it('should still derive "v2" from v2-prefixed filename', () => {
    expect(Feature.versionFromFilename('v2-enhanced.feature')).toBe('v2');
  });

  it('should derive "mvp" from unprefixed filename', () => {
    expect(Feature.versionFromFilename('basic-thing.feature')).toBe('mvp');
  });

  it('should derive "mvp" from mvp-prefixed filename', () => {
    expect(Feature.versionFromFilename('mvp-thing.feature')).toBe('mvp');
  });
});
