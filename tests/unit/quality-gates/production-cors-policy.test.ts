import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Unit tests for production CORS policy configuration.
 *
 * Verifies that render.yaml defines ALLOWED_ORIGINS with the production
 * hostname so that CORS is not left as the permissive wildcard (*).
 */

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Production CORS policy (render.yaml)', () => {
  const renderYaml = readFileSync(join(ROOT, 'render.yaml'), 'utf-8');

  it('defines ALLOWED_ORIGINS environment variable', () => {
    expect(renderYaml).toContain('key: ALLOWED_ORIGINS');
  });

  it('sets ALLOWED_ORIGINS to a non-empty value', () => {
    const lines = renderYaml.split('\n');
    let foundKey = false;
    let value = '';
    for (const line of lines) {
      if (line.includes('key: ALLOWED_ORIGINS')) {
        foundKey = true;
        continue;
      }
      if (foundKey && line.includes('value:')) {
        value = line
          .split('value:')[1]
          .trim()
          .replace(/^['"]|['"]$/g, '');
        break;
      }
    }
    expect(foundKey).toBe(true);
    expect(value.length).toBeGreaterThan(0);
  });

  it('includes the production Render hostname', () => {
    expect(renderYaml).toContain('https://roadmap-5vvp.onrender.com');
  });

  it('uses HTTPS for all allowed origins', () => {
    const lines = renderYaml.split('\n');
    let foundKey = false;
    for (const line of lines) {
      if (line.includes('key: ALLOWED_ORIGINS')) {
        foundKey = true;
        continue;
      }
      if (foundKey && line.includes('value:')) {
        const value = line
          .split('value:')[1]
          .trim()
          .replace(/^['"]|['"]$/g, '');
        const origins = value.split(',').map(s => s.trim());
        for (const origin of origins) {
          if (origin.length > 0) {
            expect(origin).toMatch(/^https:\/\//);
          }
        }
        break;
      }
    }
    expect(foundKey).toBe(true);
  });
});
