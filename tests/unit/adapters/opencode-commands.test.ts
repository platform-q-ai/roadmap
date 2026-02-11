import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const COMMANDS_DIR = join(ROOT, '.opencode', 'commands');
const CLI_DIR = join(ROOT, 'src', 'adapters', 'cli');

const COMPONENT_COMMANDS = [
  'component-create.md',
  'component-delete.md',
  'component-update.md',
  'component-progress.md',
  'component-publish.md',
];

const CLI_ADAPTERS = [
  'component-create.ts',
  'component-delete.ts',
  'component-update.ts',
  'export.ts',
];

describe('OpenCode command files', () => {
  describe('existence', () => {
    for (const cmd of COMPONENT_COMMANDS) {
      it(`${cmd} exists`, () => {
        const filePath = join(COMMANDS_DIR, cmd);
        expect(existsSync(filePath)).toBe(true);
      });
    }
  });

  describe('frontmatter', () => {
    for (const cmd of COMPONENT_COMMANDS) {
      it(`${cmd} has description in frontmatter`, () => {
        const filePath = join(COMMANDS_DIR, cmd);
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toMatch(/^---\n[\s\S]*description:/m);
      });
    }
  });

  describe('$ARGUMENTS placeholder', () => {
    const cmdsWithArgs = COMPONENT_COMMANDS.filter(c => c !== 'component-publish.md');
    for (const cmd of cmdsWithArgs) {
      it(`${cmd} references $ARGUMENTS`, () => {
        const filePath = join(COMMANDS_DIR, cmd);
        const content = readFileSync(filePath, 'utf-8');
        expect(content).toContain('$ARGUMENTS');
      });
    }
  });

  describe('command content structure', () => {
    it('component-create.md instructs creating a component', () => {
      const content = readFileSync(join(COMMANDS_DIR, 'component-create.md'), 'utf-8');
      expect(content.toLowerCase()).toContain('create');
      expect(content.toLowerCase()).toContain('component');
    });

    it('component-delete.md instructs deleting a component', () => {
      const content = readFileSync(join(COMMANDS_DIR, 'component-delete.md'), 'utf-8');
      expect(content.toLowerCase()).toContain('delete');
      expect(content.toLowerCase()).toContain('component');
    });

    it('component-update.md instructs updating a component', () => {
      const content = readFileSync(join(COMMANDS_DIR, 'component-update.md'), 'utf-8');
      expect(content.toLowerCase()).toContain('update');
    });

    it('component-progress.md instructs updating progress', () => {
      const content = readFileSync(join(COMMANDS_DIR, 'component-progress.md'), 'utf-8');
      expect(content.toLowerCase()).toContain('progress');
    });

    it('component-publish.md instructs publishing to web', () => {
      const content = readFileSync(join(COMMANDS_DIR, 'component-publish.md'), 'utf-8');
      expect(content.toLowerCase()).toContain('publish');
    });
  });
});

const RENDER_API_BASE_URL = 'https://roadmap-5vvp.onrender.com';

const API_ROUTE_MAP: Record<string, { method: string; path: string }> = {
  'component-create.md': { method: 'POST', path: '/api/components' },
  'component-delete.md': { method: 'DELETE', path: '/api/components' },
  'component-update.md': { method: 'PATCH', path: '/api/components' },
  'component-progress.md': { method: 'PATCH', path: '/api/components' },
};

describe('OpenCode commands use Render production API', () => {
  describe('Render API base URL', () => {
    for (const cmd of COMPONENT_COMMANDS) {
      it(`${cmd} references the Render production URL`, () => {
        const content = readFileSync(join(COMMANDS_DIR, cmd), 'utf-8');
        expect(content).toContain(RENDER_API_BASE_URL);
      });
    }
  });

  describe('no localhost references', () => {
    for (const cmd of COMPONENT_COMMANDS) {
      it(`${cmd} does not reference localhost`, () => {
        const content = readFileSync(join(COMMANDS_DIR, cmd), 'utf-8');
        expect(content).not.toContain('http://localhost:3000');
      });
    }
  });

  describe('API route references', () => {
    for (const [cmd, route] of Object.entries(API_ROUTE_MAP)) {
      it(`${cmd} references ${route.method} ${route.path}`, () => {
        const content = readFileSync(join(COMMANDS_DIR, cmd), 'utf-8');
        expect(content).toContain(route.method);
        expect(content).toContain(route.path);
      });
    }

    it('component-publish.md references the Render API base URL', () => {
      const content = readFileSync(join(COMMANDS_DIR, 'component-publish.md'), 'utf-8');
      expect(content).toContain(RENDER_API_BASE_URL);
    });
  });

  describe('no CLI adapter references', () => {
    for (const cmd of COMPONENT_COMMANDS) {
      it(`${cmd} does not reference npx tsx`, () => {
        const content = readFileSync(join(COMMANDS_DIR, cmd), 'utf-8');
        expect(content).not.toContain('npx tsx');
      });
    }

    for (const cmd of COMPONENT_COMMANDS) {
      it(`${cmd} does not reference src/adapters/cli`, () => {
        const content = readFileSync(join(COMMANDS_DIR, cmd), 'utf-8');
        expect(content).not.toContain('src/adapters/cli');
      });
    }
  });

  describe('curl examples use Render URL', () => {
    for (const cmd of COMPONENT_COMMANDS) {
      it(`${cmd} contains curl examples with Render URL`, () => {
        const content = readFileSync(join(COMMANDS_DIR, cmd), 'utf-8');
        expect(content).toContain('curl');
        expect(content).toContain(RENDER_API_BASE_URL);
      });
    }
  });
});

describe('README reflects Render deployment', () => {
  const readmePath = join(ROOT, 'README.md');

  it('README contains the Render deployment URL', () => {
    const content = readFileSync(readmePath, 'utf-8');
    expect(content).toContain('https://roadmap-5vvp.onrender.com');
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
        const filePath = join(CLI_DIR, adapter);
        expect(existsSync(filePath)).toBe(true);
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

    it('component-update.ts imports UpdateProgress use case', () => {
      const content = readFileSync(join(CLI_DIR, 'component-update.ts'), 'utf-8');
      expect(content).toContain('UpdateProgress');
    });

    it('export.ts imports ExportArchitecture use case', () => {
      const content = readFileSync(join(CLI_DIR, 'export.ts'), 'utf-8');
      expect(content).toContain('ExportArchitecture');
    });
  });
});
