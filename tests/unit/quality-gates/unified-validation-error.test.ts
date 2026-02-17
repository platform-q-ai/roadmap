import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Unit tests for unified ValidationError.
 *
 * Ensures there is a single source of truth for ValidationError
 * (in src/domain/errors.ts) and that the use-cases layer does not
 * define its own duplicate class.
 */

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Unified ValidationError', () => {
  it('domain/errors.ts exports ValidationError', () => {
    const content = readFileSync(join(ROOT, 'src/domain/errors.ts'), 'utf-8');
    expect(content).toMatch(/export class ValidationError\b/);
  });

  it('use-cases/errors.ts does NOT define ValidationError', () => {
    const content = readFileSync(join(ROOT, 'src/use-cases/errors.ts'), 'utf-8');
    expect(content).not.toMatch(/export class ValidationError\b/);
  });

  it('use-cases barrel re-exports ValidationError from domain', () => {
    const content = readFileSync(join(ROOT, 'src/use-cases/index.ts'), 'utf-8');
    expect(content).toContain('ValidationError');
    expect(content).toContain("'../domain/");
  });

  it('no use-case file imports ValidationError from ./errors.js', () => {
    const useCasesDir = join(ROOT, 'src', 'use-cases');
    const files = readdirSync(useCasesDir).filter(
      f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'errors.ts'
    );

    const importPattern = /import\s+\{[^}]*ValidationError[^}]*\}\s+from\s+'\.\/errors\.js'/;
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(join(useCasesDir, file), 'utf-8');
      if (importPattern.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('adapters can do instanceof check with the unified ValidationError', async () => {
    const { ValidationError: DomainVE } = await import('../../../src/domain/errors.js');
    const err = new DomainVE('test');
    expect(err).toBeInstanceOf(DomainVE);
    expect(err.name).toBe('ValidationError');
  });
});
