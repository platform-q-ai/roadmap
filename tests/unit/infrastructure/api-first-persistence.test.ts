import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDrizzleConnection } from '../../../src/infrastructure/drizzle/connection.js';

const ROOT = join(__dirname, '..', '..', '..');

describe('API-first persistence infrastructure', () => {
  describe('Dockerfile', () => {
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf-8');

    it('should run build:ts as the build step', () => {
      expect(dockerfile).toContain('npm run build:ts');
    });

    it('should not run build:data during image build', () => {
      expect(dockerfile).not.toContain('build:data');
    });

    it('should not run build:db during image build', () => {
      expect(dockerfile).not.toContain('build:db');
    });

    it('should not run seed:features during image build', () => {
      expect(dockerfile).not.toContain('seed:features');
    });

    it('should not install sqlite3 CLI (no longer needed for build)', () => {
      expect(dockerfile).not.toContain('apt-get install');
      expect(dockerfile).not.toContain('sqlite3');
    });
  });

  describe('render.yaml', () => {
    const renderYaml = readFileSync(join(ROOT, 'render.yaml'), 'utf-8');

    it('should include a disk configuration', () => {
      expect(renderYaml).toContain('disk');
    });

    it('should mount the disk at /data', () => {
      expect(renderYaml).toContain('/data');
    });

    it('should set DB_PATH environment variable', () => {
      expect(renderYaml).toContain('DB_PATH');
    });

    it('should point DB_PATH to the persistent disk', () => {
      expect(renderYaml).toContain('/data/architecture.db');
    });
  });

  describe('server DB_PATH resolution (start.ts)', () => {
    const startTs = readFileSync(join(ROOT, 'src', 'adapters', 'api', 'start.ts'), 'utf-8');

    it('should read DB_PATH from process.env', () => {
      expect(startTs).toContain('process.env.DB_PATH');
    });

    it('should use nullish coalescing to fall back to a default path', () => {
      expect(startTs).toMatch(/process\.env\.DB_PATH\s*\?\?/);
    });
  });

  describe('createDrizzleConnection directory creation', () => {
    it('should create parent directories if they do not exist', () => {
      const testDir = join(tmpdir(), `roadmap-test-${Date.now()}`);
      const dbPath = join(testDir, 'sub', 'architecture.db');
      try {
        const db = createDrizzleConnection(dbPath);
        expect(db).toBeDefined();
        expect(existsSync(dbPath)).toBe(true);
      } finally {
        if (existsSync(testDir)) {
          rmSync(testDir, { recursive: true, force: true });
        }
      }
    });
  });
});
