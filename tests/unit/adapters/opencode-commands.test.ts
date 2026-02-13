import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const COMMANDS_DIR = join(ROOT, '.opencode', 'commands');
const CLI_DIR = join(ROOT, 'src', 'adapters', 'cli');
const AGENTS_MD = join(ROOT, 'AGENTS.md');

const WORKFLOW_COMMANDS = ['bdd.md', 'ship.md'];

const REMOVED_COMMANDS = [
  'component-create.md',
  'component-delete.md',
  'component-update.md',
  'component-publish.md',
  'component-list.md',
  'component-show.md',
  'component-edges.md',
  'component-deps.md',
  'feature-list.md',
  'feature-upload.md',
  'feature-delete.md',
];

const CLI_ADAPTERS = ['component-create.ts', 'component-delete.ts'];

const RENDER_API_BASE_URL = 'https://roadmap-5vvp.onrender.com';

// Every API endpoint that must be documented in AGENTS.md
const API_ENDPOINTS = [
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/architecture' },
  { method: 'GET', path: '/api/components' },
  { method: 'GET', path: '/api/components/:id' },
  { method: 'POST', path: '/api/components' },
  { method: 'DELETE', path: '/api/components/:id' },
  { method: 'GET', path: '/api/components/:id/features' },
  { method: 'PUT', path: '/api/components/:id/features/:filename' },
  { method: 'DELETE', path: '/api/components/:id/features/:filename' },
  { method: 'GET', path: '/api/components/:id/edges' },
  { method: 'GET', path: '/api/components/:id/dependencies' },
];

describe('OpenCode command files', () => {
  describe('workflow commands exist', () => {
    for (const cmd of WORKFLOW_COMMANDS) {
      it(`${cmd} exists`, () => {
        expect(existsSync(join(COMMANDS_DIR, cmd))).toBe(true);
      });
    }
  });

  describe('workflow commands have frontmatter', () => {
    for (const cmd of WORKFLOW_COMMANDS) {
      it(`${cmd} has description in frontmatter`, () => {
        const content = readFileSync(join(COMMANDS_DIR, cmd), 'utf-8');
        expect(content).toMatch(/^---\n[\s\S]*description:/m);
      });
    }
  });

  describe('component/feature command files removed', () => {
    for (const cmd of REMOVED_COMMANDS) {
      it(`${cmd} does not exist`, () => {
        expect(existsSync(join(COMMANDS_DIR, cmd))).toBe(false);
      });
    }
  });

  describe('only workflow commands remain', () => {
    it('commands directory contains only bdd.md and ship.md', () => {
      const files = readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
      expect(files.sort()).toEqual(WORKFLOW_COMMANDS.sort());
    });
  });
});

describe('AGENTS.md documents all API endpoints', () => {
  const content = readFileSync(AGENTS_MD, 'utf-8');

  it('has a REST API section', () => {
    expect(content).toContain('## REST API');
  });

  it('contains the Render production URL', () => {
    expect(content).toContain(RENDER_API_BASE_URL);
  });

  it('does not reference localhost for API', () => {
    expect(content).not.toContain('http://localhost:3000');
  });

  it('contains curl examples', () => {
    expect(content).toContain('curl');
    expect(content).toContain(RENDER_API_BASE_URL);
  });

  describe('endpoint coverage', () => {
    for (const ep of API_ENDPOINTS) {
      it(`documents ${ep.method} ${ep.path}`, () => {
        expect(content).toContain(ep.method);
        expect(content).toContain(ep.path);
      });
    }
  });

  describe('curl examples for key operations', () => {
    it('has curl example for listing components', () => {
      expect(content).toMatch(/curl\s+https:\/\/roadmap.*\/api\/components/);
    });

    it('has curl example for creating a component', () => {
      expect(content).toContain('-X POST');
      expect(content).toContain('/api/components');
    });

    it('has curl example for deleting a component', () => {
      expect(content).toContain('-X DELETE');
      expect(content).toContain('/api/components/');
    });

    it('has curl example for uploading a feature', () => {
      expect(content).toContain('-X PUT');
      expect(content).toContain('/features/');
    });

    it('has curl example for getting edges', () => {
      expect(content).toContain('/edges');
    });

    it('has curl example for getting dependencies', () => {
      expect(content).toContain('/dependencies');
    });

    it('has curl example for full architecture export', () => {
      expect(content).toContain('/api/architecture');
    });
  });

  it('notes that CRUD is done via API, not slash commands', () => {
    expect(content).toMatch(/REST API|API endpoints/i);
    expect(content).toContain('no separate slash commands');
  });
});

describe('AGENTS.md coverage thresholds', () => {
  const content = readFileSync(AGENTS_MD, 'utf-8');

  it('references 90% coverage thresholds', () => {
    expect(content).toContain('90%');
  });

  it('does not reference old 80% thresholds', () => {
    expect(content).not.toContain('80%');
  });
});

describe('README reflects Render deployment', () => {
  const readmePath = join(ROOT, 'README.md');

  it('README contains the Render deployment URL', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain(RENDER_API_BASE_URL);
  });

  it('README does not reference GitHub Pages URL', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).not.toContain('github.io/roadmap');
  });

  it('README does not reference GitHub Pages', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).not.toContain('GitHub Pages');
  });

  it('README does not reference pages.yml', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).not.toContain('pages.yml');
  });

  it('README deployment section mentions Render', () => {
    const content = readFileSync(readmePath, 'utf-8');
    const sections = content.split(/^## /m);
    const deploySection = sections.find(s => s.startsWith('Deployment'));
    expect(deploySection).toBeDefined();
    expect(deploySection).toContain('Render');
  });

  it('README does not reference CI/CD to GitHub Pages in tech stack', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).not.toContain('CI/CD to GitHub Pages');
  });
});

describe('GitHub Pages workflow removed', () => {
  it('pages.yml does not exist in .github/workflows', () => {
    const pagesPath = join(ROOT, '.github', 'workflows', 'pages.yml');
    expect(existsSync(pagesPath)).toBe(false);
  });
});

describe('CLI adapter scripts', () => {
  describe('existence', () => {
    for (const adapter of CLI_ADAPTERS) {
      it(`${adapter} exists`, () => {
        expect(existsSync(join(CLI_DIR, adapter))).toBe(true);
      });
    }
  });

  describe('content', () => {
    it('component-create.ts imports CreateComponent use case', () => {
      const content = readFileSync(join(CLI_DIR, 'component-create.ts'), 'utf-8');
      expect(content).toContain('CreateComponent');
    });

    it('component-delete.ts imports DeleteComponent use case', () => {
      const content = readFileSync(join(CLI_DIR, 'component-delete.ts'), 'utf-8');
      expect(content).toContain('DeleteComponent');
    });
  });
});
