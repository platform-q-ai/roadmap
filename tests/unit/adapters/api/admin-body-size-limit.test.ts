import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { readBody } from '../../../../src/adapters/api/routes-shared.js';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

describe('Admin route body size limit', () => {
  it('admin-routes.ts should not define its own readBody function', () => {
    const source = readFileSync(join(ROOT, 'src/adapters/api/admin-routes.ts'), 'utf-8');
    const definesOwnReadBody =
      /^(?:async\s+)?function\s+readBody\s*\(/m.test(source) ||
      /^const\s+readBody\s*=/m.test(source);
    expect(definesOwnReadBody).toBe(false);
  });

  it('admin-routes.ts should import readBody from routes-shared', () => {
    const source = readFileSync(join(ROOT, 'src/adapters/api/admin-routes.ts'), 'utf-8');
    expect(source).toMatch(/import\s+.*readBody.*from\s+['"]\.\/routes-shared/);
  });

  it('readBody rejects bodies larger than 1 MB', async () => {
    const payload = 'x'.repeat(1024 * 1024 + 1);
    const stream = Readable.from([Buffer.from(payload)]);
    await expect(readBody(stream as never)).rejects.toThrow(/too large/i);
  });

  it('readBody accepts bodies within the 1 MB limit', async () => {
    const payload = 'x'.repeat(500);
    const stream = Readable.from([Buffer.from(payload)]);
    const result = await readBody(stream as never);
    expect(result).toBe(payload);
  });
});
