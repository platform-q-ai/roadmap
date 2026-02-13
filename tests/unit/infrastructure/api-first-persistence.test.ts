import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDrizzleConnection } from '../../../src/infrastructure/drizzle/index.js';

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

    it('should create db/ directory owned by node for fallback path', () => {
      expect(dockerfile).toContain('mkdir -p db');
      expect(dockerfile).toContain('chown node:node db');
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

  describe('createDrizzleConnection directory handling', () => {
    const testDirs: string[] = [];

    function makeTempDir(): string {
      const dir = join(
        tmpdir(),
        `roadmap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      testDirs.push(dir);
      return dir;
    }

    afterEach(() => {
      for (const dir of testDirs) {
        if (existsSync(dir)) {
          // Restore write permissions before cleanup so rmSync works
          try {
            chmodSync(dir, 0o755);
          } catch {
            /* best-effort */
          }
          rmSync(dir, { recursive: true, force: true });
        }
      }
      testDirs.length = 0;
    });

    it('should create parent directories if they do not exist', () => {
      const testDir = makeTempDir();
      const dbPath = join(testDir, 'sub', 'architecture.db');
      const db = createDrizzleConnection(dbPath);
      expect(db).toBeDefined();
      expect(existsSync(dbPath)).toBe(true);
    });

    it('should succeed when the directory already exists and is writable', () => {
      const testDir = makeTempDir();
      mkdirSync(testDir, { recursive: true });
      const dbPath = join(testDir, 'architecture.db');
      const db = createDrizzleConnection(dbPath);
      expect(db).toBeDefined();
      expect(existsSync(dbPath)).toBe(true);
    });

    it('should throw with actionable message when directory exists but is not writable', () => {
      const testDir = makeTempDir();
      mkdirSync(testDir, { recursive: true });
      chmodSync(testDir, 0o444); // read-only

      const dbPath = join(testDir, 'architecture.db');
      expect(() => createDrizzleConnection(dbPath)).toThrowError(
        /not writable by the current user/
      );
      expect(() => createDrizzleConnection(dbPath)).toThrowError(/DB_PATH/);
    });

    it('should throw with actionable message when parent directory cannot be created', () => {
      const testDir = makeTempDir();
      mkdirSync(testDir, { recursive: true });
      chmodSync(testDir, 0o444); // read-only parent

      // Attempt to create a subdirectory inside a read-only directory
      const dbPath = join(testDir, 'sub', 'architecture.db');
      expect(() => createDrizzleConnection(dbPath)).toThrowError(
        /Cannot create database directory/
      );
      expect(() => createDrizzleConnection(dbPath)).toThrowError(/DB_PATH/);
    });
  });
});
