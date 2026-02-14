import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const seedSql = readFileSync(join(ROOT, 'seed.sql'), 'utf-8');

describe('Seed data — orchestration components marked complete', () => {
  const componentIds = [
    'orchestrator-session',
    'worker-session-1',
    'worker-session-2',
    'worker-session-3',
    'worker-session-4',
  ];

  describe('current_version set to 1.0.0', () => {
    for (const id of componentIds) {
      it(`${id} should have current_version '1.0.0' in seed.sql`, () => {
        // The nodes table INSERT should include current_version for this node
        const nodePattern = new RegExp(`'${id}'[^)]*`);
        const match = seedSql.match(nodePattern);
        expect(match).not.toBeNull();
        expect(match![0]).toContain("'1.0.0'");
      });
    }
  });

  describe('color set to green', () => {
    for (const id of componentIds) {
      it(`${id} should have color 'green' in seed.sql`, () => {
        const nodePattern = new RegExp(`'${id}'[^)]*`);
        const match = seedSql.match(nodePattern);
        expect(match).not.toBeNull();
        expect(match![0]).toContain("'green'");
      });
    }
  });

  describe('tagged as pre-existing', () => {
    for (const id of [...componentIds, 'meta-agent']) {
      it(`${id} should have "pre-existing" tag in seed.sql`, () => {
        const nodePattern = new RegExp(`'${id}'[^)]*`);
        const match = seedSql.match(nodePattern);
        expect(match).not.toBeNull();
        expect(match![0]).toContain('"pre-existing"');
      });
    }
  });
});

describe('Seed data — version records at 100%', () => {
  const componentIds = [
    'orchestrator-session',
    'worker-session-1',
    'worker-session-2',
    'worker-session-3',
    'worker-session-4',
  ];

  for (const id of componentIds) {
    describe(`${id} version records`, () => {
      it(`should have overview version at 100% complete`, () => {
        const pattern = new RegExp(
          `'${id}'\\s*,\\s*'overview'\\s*,[^,]*,\\s*(\\d+)\\s*,\\s*'([^']+)'`
        );
        const match = seedSql.match(pattern);
        expect(match).not.toBeNull();
        expect(parseInt(match![1], 10)).toBe(100);
        expect(match![2]).toBe('complete');
      });

      it(`should have mvp version at 100% complete`, () => {
        const pattern = new RegExp(`'${id}'\\s*,\\s*'mvp'\\s*,[^,]*,\\s*(\\d+)\\s*,\\s*'([^']+)'`);
        const match = seedSql.match(pattern);
        expect(match).not.toBeNull();
        expect(parseInt(match![1], 10)).toBe(100);
        expect(match![2]).toBe('complete');
      });
    });
  }
});
