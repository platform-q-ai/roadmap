import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

describe('Security policy', () => {
  it('SECURITY.md should exist in the repository root', () => {
    expect(existsSync(join(ROOT, 'SECURITY.md'))).toBe(true);
  });

  it('should contain a Reporting a Vulnerability section', () => {
    const content = readFile('SECURITY.md');
    expect(content).toMatch(/^#+\s+Reporting a Vulnerability/m);
  });

  it('should include a private contact method', () => {
    const content = readFile('SECURITY.md');
    const hasEmail = /@/.test(content);
    const hasPrivateAdvisory = /security advisory/i.test(content) || /privately/i.test(content);
    expect(hasEmail || hasPrivateAdvisory).toBe(true);
  });

  it('should not instruct reporters to open a public issue', () => {
    const content = readFile('SECURITY.md').toLowerCase();
    expect(content).not.toContain('open a public issue');
    expect(content).not.toContain('open an issue');
  });

  it('should state a response timeframe', () => {
    const content = readFile('SECURITY.md');
    expect(content).toMatch(/\d+\s*(business\s+)?days?/i);
  });

  it('should contain a Supported Versions section', () => {
    const content = readFile('SECURITY.md');
    expect(content).toMatch(/^#+\s+Supported Versions/m);
  });
});
