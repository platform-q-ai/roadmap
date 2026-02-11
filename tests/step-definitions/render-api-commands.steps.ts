import { strict as assert } from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

const RENDER_BASE_URL = 'https://roadmap-5vvp.onrender.com';

const COMPONENT_COMMANDS = [
  'component-create.md',
  'component-delete.md',
  'component-update.md',
  'component-progress.md',
  'component-publish.md',
];

interface RenderApiWorld {
  readmeContent: string | null;
  [key: string]: unknown;
}

// ─── Given ────────────────────────────────────────────────────────────

Given('the project README file', function (this: RenderApiWorld) {
  const readmePath = join(process.cwd(), 'README.md');
  assert.ok(existsSync(readmePath), 'README.md does not exist');
  this.readmeContent = readFileSync(readmePath, 'utf-8');
});

// ─── Then (Commands use Render production URL) ──────────────────────

Then(
  'every component command file references the Render production URL',
  function (this: RenderApiWorld) {
    const violations: string[] = [];
    for (const cmd of COMPONENT_COMMANDS) {
      const filePath = join(process.cwd(), '.opencode', 'commands', cmd);
      const content = readFileSync(filePath, 'utf-8');
      if (!content.includes(RENDER_BASE_URL)) {
        violations.push(cmd);
      }
    }
    assert.equal(
      violations.length,
      0,
      `These command files do not reference the Render production URL: ${violations.join(', ')}`
    );
  }
);

Then(
  'the command file {string} contains the Render base URL in curl examples',
  function (this: RenderApiWorld, filename: string) {
    const filePath = join(process.cwd(), '.opencode', 'commands', filename);
    const content = readFileSync(filePath, 'utf-8');
    assert.ok(
      content.includes('curl') && content.includes(RENDER_BASE_URL),
      `Command ${filename} curl examples must use the Render base URL "${RENDER_BASE_URL}"`
    );
  }
);

// ─── Then (README) ──────────────────────────────────────────────────

Then(
  'the README contains the Render deployment URL {string}',
  function (this: RenderApiWorld, url: string) {
    assert.ok(this.readmeContent, 'README content not loaded');
    assert.ok(
      this.readmeContent.includes(url),
      `README must contain the Render deployment URL "${url}"`
    );
  }
);

Then('the README does not contain {string}', function (this: RenderApiWorld, forbidden: string) {
  assert.ok(this.readmeContent, 'README content not loaded');
  assert.ok(!this.readmeContent.includes(forbidden), `README must not contain "${forbidden}"`);
});

Then(
  'the README deployment section mentions {string}',
  function (this: RenderApiWorld, keyword: string) {
    assert.ok(this.readmeContent, 'README content not loaded');
    const deploymentSection = extractSection(this.readmeContent, 'Deployment');
    assert.ok(deploymentSection, 'README must have a "## Deployment" section');
    assert.ok(
      deploymentSection.includes(keyword),
      `README Deployment section must mention "${keyword}"`
    );
  }
);

// ─── Then (GitHub Pages workflow removed) ───────────────────────────

Then(
  'no file {string} exists in .github\\/workflows',
  function (this: RenderApiWorld, filename: string) {
    const workflowsDir = join(process.cwd(), '.github', 'workflows');
    if (!existsSync(workflowsDir)) {
      return; // No workflows dir means no file — pass
    }
    const files = readdirSync(workflowsDir);
    assert.ok(!files.includes(filename), `File "${filename}" must not exist in .github/workflows`);
  }
);

// ─── Helpers ─────────────────────────────────────────────────────────

function extractSection(markdown: string, heading: string): string | null {
  const pattern = new RegExp(`^## ${heading}[\\s\\S]*?(?=^## |$)`, 'm');
  const match = markdown.match(pattern);
  return match ? match[0] : null;
}
