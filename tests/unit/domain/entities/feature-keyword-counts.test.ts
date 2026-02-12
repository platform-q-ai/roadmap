import { Feature } from '@domain/index.js';
import { describe, expect, it } from 'vitest';

/* ──────────────────────────────────────────────────────────────────
 * Unit tests for Feature.countByKeyword() static method.
 *
 * Counts Given/When/Then steps individually, where And/But
 * inherit the preceding primary keyword's category.
 * ────────────────────────────────────────────────────────────────── */

describe('Feature.countByKeyword', () => {
  it('counts Given, When, Then keywords separately', () => {
    const content = `Feature: T
  Scenario: S
    Given step one
    When action one
    Then result one`;
    const counts = Feature.countByKeyword(content);
    expect(counts.given).toBe(1);
    expect(counts.when).toBe(1);
    expect(counts.then).toBe(1);
  });

  it('assigns And to the preceding keyword category', () => {
    const content = `Feature: T
  Scenario: S
    Given a
    And b
    When c
    Then d
    And e`;
    const counts = Feature.countByKeyword(content);
    expect(counts.given).toBe(2);
    expect(counts.when).toBe(1);
    expect(counts.then).toBe(2);
  });

  it('assigns But to the preceding keyword category', () => {
    const content = `Feature: T
  Scenario: S
    Given a
    When c
    Then d
    But e
    But f`;
    const counts = Feature.countByKeyword(content);
    expect(counts.given).toBe(1);
    expect(counts.when).toBe(1);
    expect(counts.then).toBe(3);
  });

  it('returns zeros for content with no steps', () => {
    const counts = Feature.countByKeyword('Feature: Empty');
    expect(counts.given).toBe(0);
    expect(counts.when).toBe(0);
    expect(counts.then).toBe(0);
  });

  it('handles multiple scenarios', () => {
    const content = `Feature: T
  Scenario: First
    Given a
    And b
    When c
    Then d
    And e
    But f

  Scenario: Second
    Given g
    When h
    Then i`;
    const counts = Feature.countByKeyword(content);
    expect(counts.given).toBe(3);
    expect(counts.when).toBe(2);
    expect(counts.then).toBe(4);
  });

  it('handles And/But before any primary keyword gracefully', () => {
    const content = `Feature: T
  Scenario: S
    And orphan step
    Given a
    When b
    Then c`;
    const counts = Feature.countByKeyword(content);
    // And before any keyword defaults to given
    expect(counts.given).toBe(2);
    expect(counts.when).toBe(1);
    expect(counts.then).toBe(1);
  });
});
