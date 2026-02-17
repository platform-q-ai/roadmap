import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

describe('Environment variable hygiene', () => {
  it('.env.example should exist in the repository root', () => {
    expect(existsSync(join(ROOT, '.env.example'))).toBe(true);
  });

  it('.env.example should list DB_PATH', () => {
    const content = readFile('.env.example');
    expect(content).toMatch(/^DB_PATH\s*=/m);
  });

  it('.env.example should list PORT', () => {
    const content = readFile('.env.example');
    expect(content).toMatch(/^PORT\s*=/m);
  });

  it('.env.example should list ALLOWED_ORIGINS', () => {
    const content = readFile('.env.example');
    expect(content).toMatch(/^ALLOWED_ORIGINS\s*=/m);
  });

  it('.env.example should list API_KEY_SEED', () => {
    const content = readFile('.env.example');
    expect(content).toMatch(/^API_KEY_SEED\s*=/m);
  });

  it('.env.example should not contain real secrets', () => {
    const content = readFile('.env.example');
    expect(content).not.toMatch(/rmap_[0-9a-f]{32}/i);
    expect(content).not.toMatch(/sk[-_]live[-_]/i);
    expect(content).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
  });

  it('.gitignore should exclude .env files', () => {
    const content = readFile('.gitignore');
    const lines = content.split('\n').map(l => l.trim());
    expect(lines).toContain('.env');
  });

  it('.env should never have been committed to git history', () => {
    const result = execSync('git log --all --diff-filter=A --name-only --format= -- ".env"', {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim();
    expect(result).toBe('');
  });
});
