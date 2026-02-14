import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', '..');

describe('Remove seed process from build pipeline', () => {
  describe('package.json scripts', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const scripts = pkg.scripts as Record<string, string>;

    it('build script should only compile TypeScript', () => {
      expect(scripts['build']).toBe('npm run build:ts');
    });

    it('should not have a build:db script', () => {
      expect(scripts['build:db']).toBeUndefined();
    });

    it('should not have a build:data script', () => {
      expect(scripts['build:data']).toBeUndefined();
    });

    it('should not have a seed:features script', () => {
      expect(scripts['seed:features']).toBeUndefined();
    });

    it('should not have an export script', () => {
      expect(scripts['export']).toBeUndefined();
    });
  });

  describe('CLI adapters removed', () => {
    it('seed-features.ts should not exist', () => {
      expect(existsSync(join(ROOT, 'src', 'adapters', 'cli', 'seed-features.ts'))).toBe(false);
    });

    it('export.ts should not exist', () => {
      expect(existsSync(join(ROOT, 'src', 'adapters', 'cli', 'export.ts'))).toBe(false);
    });
  });

  describe('generated data files removed', () => {
    it('web/data.json should not exist', () => {
      expect(existsSync(join(ROOT, 'web', 'data.json'))).toBe(false);
    });

    it('db/architecture.db should not exist', () => {
      expect(existsSync(join(ROOT, 'db', 'architecture.db'))).toBe(false);
    });
  });

  describe('reference files retained', () => {
    it('schema.sql should still exist as reference', () => {
      expect(existsSync(join(ROOT, 'schema.sql'))).toBe(true);
    });
  });

  describe('seed artifacts removed', () => {
    it('seed.sql should not exist', () => {
      expect(existsSync(join(ROOT, 'seed.sql'))).toBe(false);
    });

    it('scripts/seed-via-api.ts should not exist', () => {
      expect(existsSync(join(ROOT, 'scripts', 'seed-via-api.ts'))).toBe(false);
    });
  });

  describe('Dockerfile has no seed artifacts', () => {
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf-8');

    it('should not reference seed.sql', () => {
      expect(dockerfile).not.toContain('seed.sql');
    });

    it('should not reference data.json', () => {
      expect(dockerfile).not.toContain('data.json');
    });
  });
});
