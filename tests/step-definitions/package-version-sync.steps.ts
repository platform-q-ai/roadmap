import { Given, When } from '@cucumber/cucumber';

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
