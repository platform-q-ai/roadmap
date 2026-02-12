import { Feature } from '@domain/index.js';
import { describe, expect, it } from 'vitest';

/* ──────────────────────────────────────────────────────────────────
 * Unit tests for Feature validation static methods.
 *
 * Tests new domain methods for filename and content validation:
 * - isValidFeatureExtension (filename must end with .feature)
 * - isKebabCaseFilename (filename must be kebab-case)
 * - findFirstSyntaxError (locate invalid lines with line numbers)
 * ────────────────────────────────────────────────────────────────── */

describe('Feature.isValidFeatureExtension', () => {
  it('returns true for .feature extension', () => {
    expect(Feature.isValidFeatureExtension('test.feature')).toBe(true);
  });

  it('returns false for .txt extension', () => {
    expect(Feature.isValidFeatureExtension('test.txt')).toBe(false);
  });

  it('returns false for no extension', () => {
    expect(Feature.isValidFeatureExtension('test')).toBe(false);
  });

  it('returns false for .feature.bak extension', () => {
    expect(Feature.isValidFeatureExtension('test.feature.bak')).toBe(false);
  });

  it('returns true for kebab-case with .feature', () => {
    expect(Feature.isValidFeatureExtension('my-test-file.feature')).toBe(true);
  });
});

describe('Feature.isKebabCaseFilename', () => {
  it('returns true for simple kebab-case', () => {
    expect(Feature.isKebabCaseFilename('my-feature.feature')).toBe(true);
  });

  it('returns true for single word', () => {
    expect(Feature.isKebabCaseFilename('test.feature')).toBe(true);
  });

  it('returns false for underscores', () => {
    expect(Feature.isKebabCaseFilename('under_score.feature')).toBe(false);
  });

  it('returns false for camelCase', () => {
    expect(Feature.isKebabCaseFilename('camelCase.feature')).toBe(false);
  });

  it('returns false for spaces', () => {
    expect(Feature.isKebabCaseFilename('has space.feature')).toBe(false);
  });

  it('returns true for version-prefixed names', () => {
    expect(Feature.isKebabCaseFilename('v1-my-feature.feature')).toBe(true);
  });

  it('returns true for names with numbers', () => {
    expect(Feature.isKebabCaseFilename('step-2-test.feature')).toBe(true);
  });
});

describe('Feature.findFirstSyntaxError', () => {
  it('returns null for valid Gherkin', () => {
    const content = 'Feature: Valid\n  Scenario: S\n    Given a step';
    expect(Feature.findFirstSyntaxError(content)).toBeNull();
  });

  it('returns line number for invalid line in scenario', () => {
    const content = [
      'Feature: Broken',
      '  Scenario: Has error',
      '    Given valid step',
      '    When valid action',
      '    !!!INVALID GHERKIN SYNTAX!!!',
      '    Then valid result',
    ].join('\n');
    const result = Feature.findFirstSyntaxError(content);
    expect(result).not.toBeNull();
    expect(result?.line).toBe(5);
  });

  it('returns null for empty content', () => {
    expect(Feature.findFirstSyntaxError('')).toBeNull();
  });

  it('returns null for content with no Feature line', () => {
    // findFirstSyntaxError only detects in-scenario errors,
    // missing Feature: is handled by hasValidGherkin
    expect(Feature.findFirstSyntaxError('just some text')).toBeNull();
  });
});
