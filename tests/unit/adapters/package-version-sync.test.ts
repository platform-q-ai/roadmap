import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Package version sync: seed.sql', () => {
  it('roadmap node in seed.sql does not have a hardcoded current_version', () => {
    const seedSql = readFileSync(join(ROOT, 'seed.sql'), 'utf-8');

    // Extract the roadmap INSERT statement (may span multiple lines)
    const roadmapMatch = seedSql.match(
      /INSERT INTO nodes[^;]*\('roadmap'[^)]*\)[^;]*ON CONFLICT/gs
    );

    assert.ok(roadmapMatch, 'Expected roadmap INSERT in seed.sql');
    const insertBlock = roadmapMatch[0];

    // The roadmap INSERT should NOT contain a semver string as current_version
    expect(insertBlock).not.toMatch(/'\d+\.\d+\.\d+'/);
  });
});

describe('Package version sync: API adapter', () => {
  it('start.ts reads version from package.json', () => {
    const content = readFileSync(join(ROOT, 'src', 'adapters', 'api', 'start.ts'), 'utf-8');
    expect(content).toContain('package.json');
  });
});
