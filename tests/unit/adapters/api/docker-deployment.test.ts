import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

// ─── render.yaml (Docker runtime) ───────────────────────────────────

describe('render.yaml Docker runtime', () => {
  const renderPath = join(projectRoot, 'render.yaml');

  it('render.yaml exists', () => {
    expect(existsSync(renderPath)).toBe(true);
  });

  it('specifies runtime: docker', () => {
    const content = readFileSync(renderPath, 'utf-8');
    expect(content).toContain('runtime: docker');
  });

  it('does not specify runtime: node', () => {
    const content = readFileSync(renderPath, 'utf-8');
    expect(content).not.toContain('runtime: node');
  });

  it('still specifies a web service type', () => {
    const content = readFileSync(renderPath, 'utf-8');
    expect(content).toContain('type: web');
  });

  it('does not specify a buildCommand (Docker uses Dockerfile)', () => {
    const content = readFileSync(renderPath, 'utf-8');
    expect(content).not.toContain('buildCommand:');
  });

  it('still specifies the start command', () => {
    const content = readFileSync(renderPath, 'utf-8');
    expect(content.includes('startCommand:') || content.includes('start_command:')).toBe(true);
  });

  it('specifies environment variables', () => {
    const content = readFileSync(renderPath, 'utf-8');
    expect(content).toContain('NODE_ENV');
    expect(content).toContain('PORT');
  });
});

// ─── Dockerfile ─────────────────────────────────────────────────────

describe('Dockerfile', () => {
  const dockerfilePath = join(projectRoot, 'Dockerfile');

  it('exists in project root', () => {
    expect(existsSync(dockerfilePath)).toBe(true);
  });

  describe('structure', () => {
    it('starts with FROM node: base image', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toMatch(/^FROM\s+node:/m);
    });

    it('sets a WORKDIR', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toMatch(/WORKDIR\s+\/app/);
    });
  });

  describe('sqlite3 installation', () => {
    it('runs apt-get update', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('apt-get update');
    });

    it('installs sqlite3 package', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('apt-get');
      expect(content).toContain('sqlite3');
    });

    it('cleans up apt cache to reduce image size', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('rm -rf /var/lib/apt/lists');
    });
  });

  describe('dependency installation', () => {
    it('copies package.json and package-lock.json before npm ci', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      const copyPkgIndex = content.indexOf('COPY package');
      const npmCiIndex = content.indexOf('npm ci');
      expect(copyPkgIndex).toBeGreaterThan(-1);
      expect(npmCiIndex).toBeGreaterThan(-1);
      expect(copyPkgIndex).toBeLessThan(npmCiIndex);
    });

    it('runs npm ci for deterministic installs', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('npm ci');
    });
  });

  describe('build', () => {
    it('copies all source files', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('COPY . .');
    });

    it('copies source after npm ci (layer caching)', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      const npmCiIndex = content.indexOf('npm ci');
      const copyAllIndex = content.indexOf('COPY . .');
      expect(npmCiIndex).toBeGreaterThan(-1);
      expect(copyAllIndex).toBeGreaterThan(-1);
      expect(npmCiIndex).toBeLessThan(copyAllIndex);
    });

    it('runs npm run build', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('npm run build');
    });
  });

  describe('runtime', () => {
    it('exposes port 3000', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('EXPOSE 3000');
    });

    it('has CMD to start the server', () => {
      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toMatch(/CMD\s/);
      expect(content).toContain('npm');
      expect(content).toContain('start');
    });
  });
});

// ─── .dockerignore ──────────────────────────────────────────────────

describe('.dockerignore', () => {
  const dockerignorePath = join(projectRoot, '.dockerignore');

  it('exists in project root', () => {
    expect(existsSync(dockerignorePath)).toBe(true);
  });

  it('excludes node_modules', () => {
    const lines = readFileSync(dockerignorePath, 'utf-8')
      .split('\n')
      .map(l => l.trim());
    expect(lines).toContain('node_modules');
  });

  it('excludes dist', () => {
    const lines = readFileSync(dockerignorePath, 'utf-8')
      .split('\n')
      .map(l => l.trim());
    expect(lines).toContain('dist');
  });

  it('excludes .git', () => {
    const lines = readFileSync(dockerignorePath, 'utf-8')
      .split('\n')
      .map(l => l.trim());
    expect(lines).toContain('.git');
  });

  it('excludes db directory (generated file)', () => {
    const lines = readFileSync(dockerignorePath, 'utf-8')
      .split('\n')
      .map(l => l.trim());
    expect(lines).toContain('db');
  });
});
