import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

describe('Pre-commit pipeline', () => {
  const pkg = JSON.parse(readFile('package.json'));
  const preCommit = (pkg.scripts as Record<string, string>)['pre-commit'] ?? '';
  const stages = preCommit.split('&&').map((s: string) => {
    const match = s.trim().match(/^npm run (.+)$/);
    return match ? match[1] : s.trim();
  });

  it('should have 7 stages', () => {
    expect(stages).toHaveLength(7);
  });

  it('should run check:code-quality first', () => {
    expect(stages[0]).toBe('check:code-quality');
  });

  it('should run test:coverage (not bare test:unit)', () => {
    expect(stages).toContain('test:coverage');
    expect(stages).not.toContain('test:unit');
  });

  it('should run test:features last', () => {
    expect(stages[stages.length - 1]).toBe('test:features');
  });

  it('should include lint, format:check, typecheck, build:ts', () => {
    expect(stages).toContain('lint');
    expect(stages).toContain('format:check');
    expect(stages).toContain('typecheck');
    expect(stages).toContain('build:ts');
  });
});

describe('Coverage thresholds', () => {
  const vitestConfig = readFile('vitest.config.ts');

  it('should enforce 90% statements', () => {
    expect(vitestConfig).toMatch(/statements\s*:\s*90/);
  });

  it('should enforce 90% branches', () => {
    expect(vitestConfig).toMatch(/branches\s*:\s*90/);
  });

  it('should enforce 90% functions', () => {
    expect(vitestConfig).toMatch(/functions\s*:\s*90/);
  });

  it('should enforce 90% lines', () => {
    expect(vitestConfig).toMatch(/lines\s*:\s*90/);
  });

  it('should exclude CLI adapter entry points', () => {
    expect(vitestConfig).toContain('src/adapters/cli/**');
  });
});

describe('Code quality script', () => {
  const script = readFile('scripts/check-code-quality.sh');

  it('should have BDD feature coverage checks', () => {
    expect(script).toContain('.feature');
    expect(script).toContain('Scenario');
  });

  it('should run cucumber dry-run', () => {
    expect(script).toMatch(/dry-run|--dry-run/);
  });

  it('should check for orphaned step definitions', () => {
    expect(script).toMatch(/orphan|usage/i);
  });

  it('should detect barrel bypass imports', () => {
    expect(script).toMatch(/barrel|direct import|bypass/i);
  });

  it('should check domain layer for generic Error throws', () => {
    expect(script).toContain('throw new Error');
    expect(script).toContain('domain');
  });

  it('should run ESLint unused-vars check', () => {
    expect(script).toMatch(/unused-vars|no-unused-vars/);
  });

  it('should have at least 12 CHECK sections', () => {
    const checks = script.match(/CHECK\s+\d+/g) ?? [];
    expect(checks.length).toBeGreaterThanOrEqual(12);
  });
});
