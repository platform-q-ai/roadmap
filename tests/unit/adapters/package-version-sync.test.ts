import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Package version sync: API adapter', () => {
  it('start.ts reads version from package.json', () => {
    const content = readFileSync(join(ROOT, 'src', 'adapters', 'api', 'start.ts'), 'utf-8');
    expect(content).toContain('package.json');
  });
});
