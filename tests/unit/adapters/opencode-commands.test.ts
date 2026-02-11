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
