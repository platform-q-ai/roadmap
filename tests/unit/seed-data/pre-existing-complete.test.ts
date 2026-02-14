import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const seedSql = readFileSync(join(ROOT, 'seed.sql'), 'utf-8');

const ORCHESTRATION_IDS = [
  'orchestrator-session',
  'worker-session-1',
  'worker-session-2',
  'worker-session-3',
  'worker-session-4',
];

/** Extract the full seed.sql line containing a given node ID. */
function seedLineForNode(id: string): string {
  const lines = seedSql.split('\n');
  const line = lines.find(l => l.includes(`'${id}'`));
  return line ?? '';
}

describe('Seed data — orchestration components marked complete', () => {
  describe('current_version set to 1.0.0', () => {
    for (const id of ORCHESTRATION_IDS) {
      it(`${id} should have current_version '1.0.0' in seed.sql`, () => {
        const line = seedLineForNode(id);
        expect(line).toBeTruthy();
        expect(line).toContain("'1.0.0'");
      });
    }
  });

  describe('color set to green', () => {
    for (const id of ORCHESTRATION_IDS) {
      it(`${id} should have color 'green' in seed.sql`, () => {
        const line = seedLineForNode(id);
        expect(line).toBeTruthy();
        expect(line).toContain("'green'");
      });
    }
  });

  describe('tagged as pre-existing', () => {
    for (const id of [...ORCHESTRATION_IDS, 'meta-agent']) {
      it(`${id} should have "pre-existing" tag in seed.sql`, () => {
        const line = seedLineForNode(id);
        expect(line).toBeTruthy();
        expect(line).toContain('"pre-existing"');
      });
    }
  });
});
describe('Seed data — version records at 100%', () => {
  for (const id of ORCHESTRATION_IDS) {
    describe(`${id} version records`, () => {
      it(`should have overview version at 100% complete`, () => {
        // Match: ('nodeId', 'overview', '...content...', 100, 'complete')
        // Content can have commas, so match everything up to the last ', NUMBER, 'status''
        const pattern = new RegExp(
          `'${id}'\\s*,\\s*'overview'\\s*,\\s*'[^']*(?:''[^']*)*'\\s*,\\s*(\\d+)\\s*,\\s*'([^']+)'`
        );
        const match = seedSql.match(pattern);
        expect(match).not.toBeNull();
        expect(parseInt(match![1], 10)).toBe(100);
        expect(match![2]).toBe('complete');
      });

      it(`should have mvp version at 100% complete`, () => {
        const pattern = new RegExp(
          `'${id}'\\s*,\\s*'mvp'\\s*,\\s*'[^']*(?:''[^']*)*'\\s*,\\s*(\\d+)\\s*,\\s*'([^']+)'`
        );
        const match = seedSql.match(pattern);
        expect(match).not.toBeNull();
        expect(parseInt(match![1], 10)).toBe(100);
        expect(match![2]).toBe('complete');
      });
    });
  }
});
