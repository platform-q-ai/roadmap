import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Given, Then, When } from '@cucumber/cucumber';

import type { Edge } from '../../src/domain/entities/edge.js';
import type { Feature } from '../../src/domain/entities/feature.js';
import { Node } from '../../src/domain/entities/node.js';
import { Version } from '../../src/domain/entities/version.js';
import type { ArchitectureData } from '../../src/use-cases/get-architecture.js';
import { GetArchitecture } from '../../src/use-cases/get-architecture.js';
import { buildRepos } from '../helpers/build-repos.js';

interface World {
  nodes: Node[];
  edges: Edge[];
  versions: Version[];
  features: Feature[];
  packageVersion: string | null | undefined;
  result: ArchitectureData;
  [key: string]: unknown;
}

// ─── Given ──────────────────────────────────────────────────────────

Given('the package version is {string}', function (this: World, version: string) {
  this.packageVersion = version;
});

Given('the package version is null', function (this: World) {
  this.packageVersion = null;
});

// ─── When ───────────────────────────────────────────────────────────

When('I assemble the architecture with the package version', async function (this: World) {
  const repos = buildRepos(this);
  const useCase = new GetArchitecture(repos);
  this.result = await useCase.execute({ packageVersion: this.packageVersion ?? undefined });
});

// ─── Then: seed.sql check ───────────────────────────────────────────

Then(
  'the roadmap node in seed.sql should not have a hardcoded current_version',
  function (this: World) {
    const root = join(import.meta.dirname, '..', '..');
    const seedSql = readFileSync(join(root, 'seed.sql'), 'utf-8');

    // Find the INSERT for the roadmap node specifically
    // The roadmap INSERT line should NOT include a current_version value
    const roadmapInsertRegex = /INSERT INTO nodes[^;]*\('roadmap'[^)]*\)[^;]*ON CONFLICT/gs;
    const match = seedSql.match(roadmapInsertRegex);
    assert.ok(match, 'Could not find roadmap INSERT in seed.sql');

    // The roadmap INSERT should not have a version string like '0.7.5' or '1.0.0'
    // in the current_version position (10th column)
    const insertText = match[0];
    // Check that the roadmap row does NOT have a non-NULL current_version
    // The column list includes current_version, so if it has a semver value, it's hardcoded
    const hasSemver = /'\d+\.\d+\.\d+'/.test(insertText);
    assert.ok(
      !hasSemver,
      'seed.sql roadmap node still has a hardcoded current_version semver string'
    );
  }
);
