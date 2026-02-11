import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then } from '@cucumber/cucumber';

const ROOT = join(import.meta.dirname, '..', '..');

interface World {
  packageJson: Record<string, unknown>;
  preCommitScript: string;
  vitestConfig: string;
  codeQualityScript: string;
  agentsMd: string;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────

function readProjectFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

function getPackageJson(): Record<string, unknown> {
  return JSON.parse(readProjectFile('package.json'));
}

// ─── Given ────────────────────────────────────────────────

Given('the pre-commit script in package.json', function (this: World) {
  this.packageJson = getPackageJson();
  const scripts = this.packageJson.scripts as Record<string, string>;
  this.preCommitScript = scripts['pre-commit'] || '';
});

Given('the vitest config file', function (this: World) {
  this.vitestConfig = readProjectFile('vitest.config.ts');
});

Given('the code quality script', function (this: World) {
  this.codeQualityScript = readProjectFile('scripts/check-code-quality.sh');
});

Given('the AGENTS.md file', function (this: World) {
  this.agentsMd = readProjectFile('AGENTS.md');
});

// ─── Pre-commit pipeline ─────────────────────────────────

Then('it should include the {string} step', function (this: World, step: string) {
  assert.ok(
    this.preCommitScript.includes(step),
    `Pre-commit script missing "${step}". Got: ${this.preCommitScript}`
  );
});

Then(
  'it should not include a bare {string} step without coverage',
  function (this: World, _step: string) {
    // The script should use test:coverage, not test:unit
    // But test:unit can still exist as a separate npm script — we just check it's not in pre-commit
    const parts = this.preCommitScript.split('&&').map((s: string) => s.trim());
    const hasBareTestUnit = parts.some(
      (p: string) => p === 'npm run test:unit' || p === 'npm run test:unit '
    );
    assert.ok(
      !hasBareTestUnit,
      `Pre-commit should use test:coverage, not bare test:unit. Got: ${this.preCommitScript}`
    );
  }
);

Then(
  'it should run these stages in order:',
  function (this: World, dataTable: { hashes: () => Array<{ stage: string }> }) {
    const expectedStages = dataTable.hashes().map(row => row.stage);
    const actualParts = this.preCommitScript.split('&&').map((s: string) => s.trim());

    // Extract stage names from "npm run <stage>" commands
    const actualStages = actualParts
      .map((p: string) => {
        const match = p.match(/^npm run (.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    assert.deepEqual(
      actualStages,
      expectedStages,
      `Pre-commit stages mismatch.\nExpected: ${expectedStages.join(' -> ')}\nActual: ${actualStages.join(' -> ')}`
    );
  }
);

// ─── Coverage thresholds ──────────────────────────────────

Then(
  'the coverage thresholds should be:',
  function (this: World, dataTable: { hashes: () => Array<{ metric: string; value: string }> }) {
    const rows = dataTable.hashes();
    for (const row of rows) {
      const pattern = new RegExp(`${row.metric}\\s*:\\s*${row.value}`);
      assert.ok(
        pattern.test(this.vitestConfig),
        `Coverage threshold for ${row.metric} should be ${row.value}. Not found in vitest config.`
      );
    }
  }
);

Then('the coverage exclude list should contain {string}', function (this: World, pattern: string) {
  assert.ok(
    this.vitestConfig.includes(pattern),
    `Coverage exclude should contain "${pattern}". Not found in vitest config.`
  );
});

// ─── Code quality script checks ──────────────────────────

Then(
  'it should check that {string} directory contains .feature files',
  function (this: World, dir: string) {
    // The script should check features/ directory has .feature files
    assert.ok(
      this.codeQualityScript.includes('.feature') && this.codeQualityScript.includes(dir),
      `Code quality script should check ${dir} for .feature files`
    );
  }
);

Then('it should verify each feature file has at least one Scenario', function (this: World) {
  assert.ok(
    this.codeQualityScript.includes('Scenario'),
    'Code quality script should verify feature files contain Scenario'
  );
});

Then('it should run a cucumber-js dry-run to detect undefined steps', function (this: World) {
  assert.ok(
    this.codeQualityScript.includes('dry-run') || this.codeQualityScript.includes('--dry-run'),
    'Code quality script should run cucumber-js --dry-run'
  );
});

Then('it should check for orphaned step definitions via usage report', function (this: World) {
  assert.ok(
    this.codeQualityScript.includes('orphan') || this.codeQualityScript.includes('usage'),
    'Code quality script should check for orphaned step definitions'
  );
});

Then(
  'it should check for direct imports that bypass barrel exports in source',
  function (this: World) {
    assert.ok(
      this.codeQualityScript.includes('barrel') ||
        this.codeQualityScript.includes('direct import') ||
        this.codeQualityScript.includes('bypass'),
      'Code quality script should detect direct imports bypassing barrels'
    );
  }
);

Then(
  'it should check that the domain layer does not use {string}',
  function (this: World, pattern: string) {
    assert.ok(
      this.codeQualityScript.includes(pattern) ||
        (this.codeQualityScript.includes('domain') && this.codeQualityScript.includes('Error')),
      `Code quality script should check domain for "${pattern}"`
    );
  }
);

Then('it should count ESLint {string} violations', function (this: World, rule: string) {
  assert.ok(
    this.codeQualityScript.includes(rule) || this.codeQualityScript.includes('unused-vars'),
    `Code quality script should check for ${rule} violations`
  );
});

// ─── Knip ─────────────────────────────────────────────────

Given('the package.json file', function (this: World) {
  this.packageJson = getPackageJson();
});

Given('the knip config file', function (this: World) {
  this.knipConfig = readProjectFile('knip.json');
});

Given('the dependency-cruiser config file', function (this: World) {
  this.depCruiserConfig = readProjectFile('.dependency-cruiser.cjs');
});

Then('{string} should be in devDependencies', function (this: World, pkg: string) {
  const devDeps = (this.packageJson.devDependencies || {}) as Record<string, string>;
  assert.ok(devDeps[pkg], `"${pkg}" not found in devDependencies`);
});

Then('it should specify entry points including {string}', function (this: World, pattern: string) {
  assert.ok(
    (this.knipConfig as string).includes(pattern),
    `Knip config should include entry "${pattern}"`
  );
});

Then('it should specify project files including {string}', function (this: World, pattern: string) {
  assert.ok(
    (this.knipConfig as string).includes(pattern),
    `Knip config should include project "${pattern}"`
  );
});

Then('there should be a {string} npm script', function (this: World, scriptName: string) {
  const scripts = (this.packageJson.scripts || {}) as Record<string, string>;
  assert.ok(scripts[scriptName], `npm script "${scriptName}" not found in package.json`);
});

Then('it should invoke knip to check for unused exports and dependencies', function (this: World) {
  assert.ok(this.codeQualityScript.includes('knip'), 'Code quality script should invoke knip');
});

// ─── dependency-cruiser ───────────────────────────────────

Then(
  'it should have a rule preventing domain from importing infrastructure',
  function (this: World) {
    const config = this.depCruiserConfig as string;
    assert.ok(
      config.includes('domain') && config.includes('infrastructure'),
      'dependency-cruiser config should have domain->infrastructure rule'
    );
  }
);

Then('it should have a rule preventing domain from importing adapters', function (this: World) {
  const config = this.depCruiserConfig as string;
  assert.ok(
    config.includes('domain') && config.includes('adapters'),
    'dependency-cruiser config should have domain->adapters rule'
  );
});

Then('it should have a rule detecting circular dependencies', function (this: World) {
  const config = this.depCruiserConfig as string;
  assert.ok(
    config.includes('circular'),
    'dependency-cruiser config should detect circular dependencies'
  );
});

Then('it should invoke dependency-cruiser to validate architecture', function (this: World) {
  assert.ok(
    this.codeQualityScript.includes('depcruise') ||
      this.codeQualityScript.includes('dependency-cruiser'),
    'Code quality script should invoke dependency-cruiser'
  );
});

Then('it should document {string} as a quality tool', function (this: World, tool: string) {
  assert.ok(this.agentsMd.includes(tool), `AGENTS.md should document "${tool}" as a quality tool`);
});

// ─── AGENTS.md documentation ──────────────────────────────

Then('it should document {string} as a pre-commit stage', function (this: World, stage: string) {
  assert.ok(
    this.agentsMd.includes(stage),
    `AGENTS.md should document "${stage}" as a pre-commit stage`
  );
});

Then(
  'it should document at least {int} code quality script checks',
  function (this: World, minChecks: number) {
    // Find the "Code Quality Script Checks" section and count numbered items
    const section = this.agentsMd.split('Code Quality Script Checks')[1] || '';
    const beforeNextSection = section.split('###')[0] || section;
    const numberedItems = beforeNextSection.match(/^\d+\.\s+\*\*/gm) || [];
    assert.ok(
      numberedItems.length >= minChecks,
      `AGENTS.md should document at least ${minChecks} code quality checks, found ${numberedItems.length}`
    );
  }
);
