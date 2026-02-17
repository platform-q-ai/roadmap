import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));

describe('Open-source package metadata', () => {
  describe('repository field', () => {
    it('should be present', () => {
      expect(pkg.repository).toBeDefined();
    });

    it('should contain a GitHub URL', () => {
      const url = typeof pkg.repository === 'object' ? pkg.repository.url : pkg.repository;
      expect(url).toMatch(/github\.com/);
    });
  });

  describe('author field', () => {
    it('should be present and non-empty', () => {
      expect(pkg.author).toBeDefined();
      expect(String(pkg.author).trim().length).toBeGreaterThan(0);
    });
  });

  describe('bugs field', () => {
    it('should be present', () => {
      expect(pkg.bugs).toBeDefined();
    });

    it('should contain a URL ending with /issues', () => {
      const url = typeof pkg.bugs === 'object' ? pkg.bugs.url : pkg.bugs;
      expect(url).toMatch(/\/issues$/);
    });
  });

  describe('homepage field', () => {
    it('should be present and non-empty', () => {
      expect(pkg.homepage).toBeDefined();
      expect(String(pkg.homepage).trim().length).toBeGreaterThan(0);
    });
  });

  describe('keywords field', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(pkg.keywords)).toBe(true);
      expect(pkg.keywords.length).toBeGreaterThan(0);
    });

    it('should contain at least 3 entries', () => {
      expect(pkg.keywords.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('private field', () => {
    it('should be true', () => {
      expect(pkg.private).toBe(true);
    });
  });
});
