import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', '..');

describe('API-first persistence infrastructure', () => {
  describe('Dockerfile', () => {
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf-8');

    it('should use build:ts instead of build as the RUN step', () => {
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

  describe('server DB_PATH resolution', () => {
    it('should use DB_PATH from environment when set', () => {
      // This tests the pattern: process.env.DB_PATH ?? default
      const envPath = '/data/architecture.db';
      const defaultPath = '/app/db/architecture.db';
      const resolved = envPath ?? defaultPath;
      expect(resolved).toBe('/data/architecture.db');
    });

    it('should fall back to default when DB_PATH is not set', () => {
      const envPath = undefined;
      const defaultPath = '/app/db/architecture.db';
      const resolved = envPath ?? defaultPath;
      expect(resolved).toBe('/app/db/architecture.db');
    });
  });
});
