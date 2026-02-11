import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Remove updateProgress: use case layer', () => {
  it('update-progress.ts does not exist in src/use-cases', () => {
    expect(existsSync(join(ROOT, 'src', 'use-cases', 'update-progress.ts'))).toBe(false);
  });

  it('use-cases barrel does not export UpdateProgress', () => {
    const content = readFileSync(join(ROOT, 'src', 'use-cases', 'index.ts'), 'utf-8');
    expect(content).not.toContain('UpdateProgress');
    expect(content).not.toContain('update-progress');
  });
});

describe('Remove updateProgress: CLI adapter', () => {
  it('component-update.ts does not exist in src/adapters/cli', () => {
    expect(existsSync(join(ROOT, 'src', 'adapters', 'cli', 'component-update.ts'))).toBe(false);
  });
});

describe('Remove updateProgress: API routes', () => {
  it('routes.ts does not contain handleUpdateProgress', () => {
    const content = readFileSync(join(ROOT, 'src', 'adapters', 'api', 'routes.ts'), 'utf-8');
    expect(content).not.toContain('handleUpdateProgress');
  });

  it('routes.ts does not import UpdateProgress', () => {
    const content = readFileSync(join(ROOT, 'src', 'adapters', 'api', 'routes.ts'), 'utf-8');
    expect(content).not.toContain('UpdateProgress');
  });

  it('routes.ts does not contain parseProgressInput', () => {
    const content = readFileSync(join(ROOT, 'src', 'adapters', 'api', 'routes.ts'), 'utf-8');
    expect(content).not.toContain('parseProgressInput');
  });

  it('routes.ts does not register a PATCH route', () => {
    const content = readFileSync(join(ROOT, 'src', 'adapters', 'api', 'routes.ts'), 'utf-8');
    expect(content).not.toContain('PATCH');
  });
});

describe('Remove updateProgress: domain repository interface', () => {
  it('IVersionRepository does not declare updateProgress', () => {
    const content = readFileSync(
      join(ROOT, 'src', 'domain', 'repositories', 'version-repository.ts'),
      'utf-8'
    );
    expect(content).not.toContain('updateProgress');
  });
});

describe('Remove updateProgress: infrastructure implementations', () => {
  it('SQLite version repository does not have updateProgress', () => {
    const content = readFileSync(
      join(ROOT, 'src', 'infrastructure', 'sqlite', 'version-repository.ts'),
      'utf-8'
    );
    expect(content).not.toContain('updateProgress');
  });

  it('Drizzle version repository does not have updateProgress', () => {
    const content = readFileSync(
      join(ROOT, 'src', 'infrastructure', 'drizzle', 'version-repository.ts'),
      'utf-8'
    );
    expect(content).not.toContain('updateProgress');
  });
});

describe('Remove updateProgress: OpenCode commands', () => {
  it('component-progress.md does not exist', () => {
    expect(existsSync(join(ROOT, '.opencode', 'commands', 'component-progress.md'))).toBe(false);
  });

  it('component-update.md does not reference PATCH', () => {
    const content = readFileSync(
      join(ROOT, '.opencode', 'commands', 'component-update.md'),
      'utf-8'
    );
    expect(content).not.toContain('PATCH');
  });

  it('component-update.md does not reference /progress', () => {
    const content = readFileSync(
      join(ROOT, '.opencode', 'commands', 'component-update.md'),
      'utf-8'
    );
    expect(content).not.toContain('/progress');
  });
});

describe('Remove updateProgress: derived progress still intact', () => {
  it('version.ts still has deriveProgress', () => {
    const content = readFileSync(join(ROOT, 'src', 'domain', 'entities', 'version.ts'), 'utf-8');
    expect(content).toContain('deriveProgress');
  });

  it('get-architecture.ts still has applyDerivedProgress', () => {
    const content = readFileSync(join(ROOT, 'src', 'use-cases', 'get-architecture.ts'), 'utf-8');
    expect(content).toContain('applyDerivedProgress');
  });
});

describe('Remove updateProgress: documentation', () => {
  it('README does not reference update-progress', () => {
    const content = readFileSync(join(ROOT, 'README.md'), 'utf-8');
    expect(content).not.toContain('update-progress');
  });

  it('AGENTS.md does not reference update-progress', () => {
    const content = readFileSync(join(ROOT, 'AGENTS.md'), 'utf-8');
    expect(content).not.toContain('update-progress');
  });
});
