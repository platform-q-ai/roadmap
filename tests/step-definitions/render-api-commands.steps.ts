import { strict as assert } from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

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
  const sections = markdown.split(/^## /m);
  const section = sections.find(s => s.startsWith(heading));
  return section ? `## ${section}` : null;
}
