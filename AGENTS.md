# Roadmap — Instructions for LLM Engineers

This file tells you how to work with this repository. Read it before making changes.

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Database**: better-sqlite3
- **Testing**: Vitest (unit) + Cucumber.js (BDD features)
- **Linting**: ESLint with `eslint-plugin-boundaries` for architecture enforcement
- **Formatting**: Prettier
- **Git hooks**: Husky + lint-staged
- **Architecture**: Clean Architecture with ESLint boundary enforcement
- **Dead code**: knip (unused exports/dependencies)
- **Dependency validation**: dependency-cruiser (architectural boundary validation)

## What This Repo Is

Living documentation for the Open Autonomous Runtime. The source of truth is a SQLite database (`db/architecture.db`) built from `schema.sql` + `seed.sql`. The web view (`web/index.html`) is a read-only static page that reads from `web/data.json` (exported from the DB).

**Do not edit `db/architecture.db` or `web/data.json` directly.** They are generated files. Edit `seed.sql` for data changes, `schema.sql` for schema changes, `web/index.html` for UI changes.

## Architecture Overview

```
Adapters (CLI, API, MCP)  -->  Use Cases  -->  Domain (entities + interfaces)
                                    |
                           Infrastructure (SQLite)
```

```
src/
├── domain/                     # Entities + repository interfaces (zero deps)
│   ├── entities/               # Node, Edge, Version, Feature
│   │   └── index.ts            # Barrel export
│   ├── repositories/           # TypeScript interfaces (contracts only)
│   │   └── index.ts            # Barrel export
│   └── index.ts                # Layer barrel export
├── use-cases/                  # Business logic (depends only on domain)
│   ├── get-architecture.ts     # Assemble full architecture graph
│   ├── export-architecture.ts  # Get architecture + write JSON
│   ├── get-step-totals.ts      # Aggregate step counts per component/version
│   ├── seed-features.ts        # Parse + insert feature files
│   └── index.ts                # Layer barrel export
├── infrastructure/             # Concrete implementations
│   └── sqlite/                 # better-sqlite3 repository implementations
│       ├── connection.ts       # Database connection factory
│       ├── node-repository.ts
│       ├── edge-repository.ts
│       ├── version-repository.ts
│       ├── feature-repository.ts
│       └── index.ts            # Barrel export
└── adapters/                   # Entry points (CLI, future API/MCP)
    └── cli/
        ├── export.ts           # DB -> web/data.json
        └── seed-features.ts    # Scan .feature files into DB
```

Data flow:

```
seed.sql + schema.sql  -->  sqlite3  -->  architecture.db
                                               |
components/**/features/*.feature  -->  seed-features  -->  architecture.db
                                                                |
                                                          export  -->  data.json  -->  web view
```

## Clean Architecture Rules

### 1. Dependency Rule

Dependencies MUST point inward. Inner layers know nothing about outer layers.

### 2. Layer Responsibilities

| Layer | Contains | Depends On | Knows About |
|-------|----------|------------|-------------|
| **Domain** | Entities, Interfaces | Nothing | Nothing external |
| **Use Cases** | Business logic | Domain | Domain only |
| **Infrastructure** | SQLite repos, adapters | Domain | Implements domain interfaces |
| **Adapters** | CLI, API, MCP entry points | Use Cases, Infrastructure | Wires everything together |

### 3. Architecture Enforcement (ESLint)

Clean Architecture boundaries are **automatically enforced** via ESLint using `eslint-plugin-boundaries`.

| Layer | Can Import From | Cannot Import From |
|-------|-----------------|-------------------|
| **Domain** | Domain only | Use Cases, Infrastructure, Adapters |
| **Use Cases** | Use Cases, Domain | Infrastructure, Adapters |
| **Infrastructure** | Infrastructure, Domain | Use Cases, Adapters |
| **Adapters** | Adapters, Use Cases, Infrastructure | Domain (directly) |

Violation example:

```typescript
// src/domain/entities/node.ts
import { SqliteNodeRepository } from '../../infrastructure/sqlite/node-repository.js';
// Error: Clean Architecture violation: "domain" cannot import from "infrastructure"
```

### 4. Repository Pattern

- **Interfaces** defined in Domain layer (`src/domain/repositories/`)
- **Implementations** in Infrastructure layer (`src/infrastructure/sqlite/`)
- Use Cases depend on interfaces (abstractions), not implementations

### 5. Constructor Injection

Use cases receive dependencies via constructor. Adapters wire everything:

```typescript
// src/adapters/cli/export.ts — adapter wires deps
const exportArchitecture = new ExportArchitecture({
  nodeRepo: new SqliteNodeRepository(db),
  edgeRepo: new SqliteEdgeRepository(db),
  versionRepo: new SqliteVersionRepository(db),
  featureRepo: new SqliteFeatureRepository(db),
  writeJson,
});
```

### 6. Barrel Exports

Every layer and subdirectory with .ts files MUST have an `index.ts` barrel export. Import from barrels, not individual files:

```typescript
// Good
import { Node, Edge } from '../domain/index.js';

// Bad
import { Node } from '../domain/entities/node.js';
```

## BDD Red-to-Green Workflow

### Overview

```
1. FEATURE FILE (Gherkin)          features/*.feature
   Define behavior in business language
                |
2. STEP DEFINITIONS (RED)          tests/step-definitions/*.steps.ts
   Write failing step implementations
                |
3. UNIT TESTS (RED)                tests/unit/**/*.test.ts
   Write failing tests for each layer
                |
4. IMPLEMENTATION (GREEN)          src/**/*.ts
   Write minimal code to pass tests
   Order: Domain -> Use Cases -> Infrastructure -> Adapters
                |
5. REFACTOR                        Clean up while keeping tests green
```

### Step 1: Write Feature File

Start every feature with a Gherkin specification:

```gherkin
# features/example.feature
Feature: Feature Name
  As a [role]
  I want [capability]
  So that [benefit]

  Scenario: Scenario name
    Given [precondition]
    When [action]
    Then [expected outcome]
```

### Step 2: Write Step Definitions (RED)

```typescript
// tests/step-definitions/example.steps.ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'vitest';

Given('a precondition', async function() {
  // Arrange
});

When('an action occurs', async function() {
  // Act
  this.result = await this.useCase.execute(this.input);
});

Then('expected outcome', async function() {
  // Assert
  expect(this.result).toBeDefined();
});
```

### Step 3: Write Unit Tests (RED)

```typescript
// tests/unit/domain/entities/node.test.ts
import { describe, it, expect } from 'vitest';
import { Node } from '@domain/entities/node';

describe('Node Entity', () => {
  it('should create with valid data', () => {
    const node = new Node({ id: 'test', name: 'Test', type: 'component' });
    expect(node.id).toBe('test');
  });

  it('should parse tags from JSON string', () => {
    const node = new Node({ id: 'test', name: 'Test', type: 'component', tags: '["a","b"]' });
    expect(node.tags).toEqual(['a', 'b']);
  });
});
```

### Step 4: Implementation (GREEN)

Implement in order, respecting dependency rules:

1. **Domain**: Entities and interfaces (no dependencies)
2. **Use Cases**: Business logic with interface dependencies
3. **Infrastructure**: Concrete implementations
4. **Adapters**: Wire and expose

### Step 5: Refactor

- Remove duplication
- Improve naming
- Extract common patterns
- Keep tests green throughout

## PR Merge Gate (GitHub Actions)

The `.github/workflows/pr-quality-gate.yml` workflow runs on every PR targeting `master`. Both jobs must pass before merging.

### Quality Checks Job

Reruns the full pre-commit pipeline in CI:

```
1. check:code-quality   Code quality script (12 checks)
2. lint                  ESLint (includes boundary enforcement)
3. format:check          Prettier formatting
4. typecheck             TypeScript (tsc --noEmit)
5. build:ts              Compile TypeScript
6. test:coverage         Vitest unit tests with 90% coverage thresholds
7. test:features         Cucumber BDD scenarios
```

### Unresolved Comments Job

Queries the PR for unresolved review threads via the GitHub GraphQL API. If any thread is still open, the job fails and lists:

- The file path
- The comment author
- The first 120 characters of the comment body

This blocks merging until all review feedback is addressed.

### Branch Protection (Manual Setup)

To enforce these checks, enable branch protection on `master` in GitHub:

1. **Settings > Branches > Add rule** for `master`
2. Enable **Require status checks to pass before merging**
3. Add required checks: `Quality Checks` and `Unresolved Review Comments`
4. Enable **Require conversation resolution before merging** (belt and suspenders)
5. Optionally enable **Require approvals**

## Pre-Commit Pipeline

Pre-commit hooks run automatically on `git commit` via Husky:

```
1. check:code-quality   Code quality script (12 checks)
2. lint                  ESLint (includes boundary enforcement)
3. format:check          Prettier formatting
4. typecheck             TypeScript (tsc --noEmit)
5. build:ts              Compile TypeScript
6. test:coverage         Vitest unit tests with 90% coverage thresholds
7. test:features         Cucumber BDD scenarios
```

### ESLint Code Quality Rules

| Rule | Limit |
|------|-------|
| `complexity` | 10 |
| `max-depth` | 4 |
| `max-lines` | 750 |
| `max-lines-per-function` | 100 |
| `max-params` | 4 |
| `no-console` | Only `warn` and `error` (except CLI adapters) |
| `@typescript-eslint/no-explicit-any` | Error |
| `@typescript-eslint/no-non-null-assertion` | Error |

### Code Quality Script Checks

The `scripts/check-code-quality.sh` script enforces:

1. **No incomplete work markers**: TODO, FIXME, HACK, placeholder text, test doubles in production
2. **No type safety bypasses**: `as any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `console.log`
3. **Barrel exports exist** for all layers and subdirectories
4. **Clean Architecture boundaries**: domain has no outward deps, use-cases don't import infrastructure
5. **Dead code detection**: unused source files not imported anywhere
6. **AGENTS.md exists** (and matches CLAUDE.md if both present)
7. **BDD feature coverage**: feature files exist, every feature has scenarios, cucumber dry-run for undefined steps, orphaned step detection
8. **Barrel bypass detection**: direct imports that bypass barrel exports in src/
9. **Domain error discipline**: no generic `throw new Error(` in domain/use-cases layers
10. **ESLint unused-vars analysis**: counts unused variable warnings in src/
11. **Knip**: unused exports, unused dependencies, phantom dependencies
12. **dependency-cruiser**: architectural boundary validation (Clean Architecture rules, circular deps)

### Pre-Commit Checklist

Before committing, ensure:

- [ ] `npm run lint` passes with no errors
- [ ] `npm run format:check` shows no formatting issues
- [ ] `npm run typecheck` passes with no type errors
- [ ] `npm run build:ts` compiles successfully
- [ ] `npm run test:coverage` all unit tests pass with 90% coverage
- [ ] `npm run test:features` all BDD scenarios pass
- [ ] No secrets or credentials in staged files
- [ ] Commit message follows conventional format

### Conventional Commit Format

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(use-cases): add get-architecture use case
fix(infrastructure): handle null tags in node repository
test(domain): add unit tests for Edge entity
refactor(adapters): extract shared connection setup
chore(deps): update better-sqlite3 to v12
```

## Commands

```bash
npm install              # Install dependencies
npm run build            # TypeScript compile + rebuild data
npm run build:ts         # TypeScript compile only
npm run build:data       # Rebuild database + seed features + export JSON
npm run build:db         # Rebuild database only
npm run seed:features    # Re-seed feature files only
npm run export           # Re-export JSON only
npm run serve            # Serve web view locally on port 8080

npm test                 # Unit + feature tests
npm run test:unit        # Vitest unit tests
npm run test:unit:watch  # Vitest watch mode
npm run test:coverage    # Vitest with coverage
npm run test:features    # Cucumber BDD scenarios

npm run typecheck        # TypeScript type check (tsc --noEmit)
npm run lint             # ESLint (includes boundary checks)
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run check:code-quality  # Code quality script
npm run check:knip       # Knip (unused exports/dependencies)
npm run check:deps       # dependency-cruiser (architecture validation)
npm run pre-commit       # Full pre-commit pipeline
```

## File Roles

| File | Role | Edit? |
|------|------|-------|
| `schema.sql` | Database schema (4 tables) | Yes -- structural changes |
| `seed.sql` | All component data, edges, version content | Yes -- primary data file |
| `db/architecture.db` | Built SQLite database | No -- generated |
| `src/domain/entities/*.ts` | Domain entities (Node, Edge, Version, Feature) | Yes -- data model changes |
| `src/domain/repositories/*.ts` | Repository interfaces (contracts) | Yes -- new queries |
| `src/use-cases/*.ts` | Business logic | Yes -- new operations |
| `src/infrastructure/sqlite/*.ts` | SQLite implementations | Yes -- query changes |
| `src/adapters/cli/*.ts` | CLI entry points | Yes -- CLI changes |
| `web/index.html` | Interactive web view (single file) | Yes -- UI changes |
| `web/data.json` | JSON data consumed by web view | No -- generated |
| `components/*/features/*.feature` | Gherkin feature files per component | Yes -- add/edit specs |
| `eslint.config.js` | ESLint + boundary rules | Yes -- rule changes |
| `tsconfig.json` | TypeScript config | Rarely |
| `vitest.config.ts` | Vitest config | Rarely |
| `scripts/check-code-quality.sh` | Code quality gate | Yes -- add new checks |

## How to Add a New Component

1. Add the node in `seed.sql` (NODES section)
2. Add containment edge (EDGES section)
3. Add relationship edges to other components
4. Add version content for MVP / v1 / v2 (NODE VERSIONS section)
5. Create `components/<id>/features/` directory
6. Write Gherkin feature files: `mvp-*.feature`, `v1-*.feature`, `v2-*.feature`
7. Run `npm run build:data`

## How to Add a New Adapter

To add a new delivery mechanism (API server, MCP server, VS Code extension):

1. Create a new directory under `src/adapters/` (e.g., `src/adapters/api/`)
2. Wire up infrastructure (create connection, instantiate repositories)
3. Inject repositories into the use cases you need
4. Handle adapter-specific I/O (HTTP routes, MCP protocol, etc.)

Example:

```typescript
import { createConnection, SqliteNodeRepository, SqliteEdgeRepository, SqliteVersionRepository, SqliteFeatureRepository } from '../../infrastructure/sqlite/index.js';
import { GetArchitecture } from '../../use-cases/get-architecture.js';

const db = createConnection('db/architecture.db');
const getArchitecture = new GetArchitecture({
  nodeRepo: new SqliteNodeRepository(db),
  edgeRepo: new SqliteEdgeRepository(db),
  versionRepo: new SqliteVersionRepository(db),
  featureRepo: new SqliteFeatureRepository(db),
});

app.get('/api/architecture', async (req, res) => {
  const data = await getArchitecture.execute();
  res.json(data);
});
```

## Database Schema Quick Reference

```sql
nodes(id TEXT PK, name, type, layer, color, icon, description, tags TEXT/JSON, sort_order)
edges(id INT PK, source_id FK, target_id FK, type, label, metadata TEXT/JSON)
node_versions(id INT PK, node_id FK, version, content, progress INT 0-100, status, updated_at)
features(id INT PK, node_id FK, version, filename, title, content, step_count INT DEFAULT 0, updated_at)
```

Edge types: `CONTAINS`, `CONTROLS`, `DEPENDS_ON`, `READS_FROM`, `WRITES_TO`, `DISPATCHES_TO`, `ESCALATES_TO`, `PROXIES`, `SANITISES`, `GATES`, `SEQUENCE`.

## REST API

The API server runs at `https://roadmap-5vvp.onrender.com` (production) or locally via `npm run serve`.

All endpoints return JSON. Mutating endpoints accept JSON bodies (except `PUT /features/:filename` which accepts raw Gherkin text).

### Endpoints

| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| `GET` | `/api/health` | Health check | `200 { status: "ok" }` | — |
| `GET` | `/api/architecture` | Full architecture graph (layers, nodes, edges, progression_tree, stats) | `200` | — |
| `GET` | `/api/components` | List all non-layer nodes | `200 [...]` | — |
| `GET` | `/api/components/:id` | Get component with versions and features | `200` | `404` not found |
| `POST` | `/api/components` | Create a new component | `201` | `400` invalid, `409` duplicate |
| `DELETE` | `/api/components/:id` | Delete component + versions, features, edges | `204` | `404` not found |
| `GET` | `/api/components/:id/features` | List features for a component | `200 [...]` | `404` component not found |
| `PUT` | `/api/components/:id/features/:filename` | Upload/replace a feature file (body = raw Gherkin text) | `200` | `404` component not found |
| `DELETE` | `/api/components/:id/features/:filename` | Delete a single feature file | `204` | `404` not found |
| `GET` | `/api/components/:id/edges` | Get inbound and outbound edges | `200 { inbound, outbound }` | `404` component not found |
| `GET` | `/api/components/:id/dependencies` | Get DEPENDS_ON edges (dependencies + dependents) | `200 { dependencies, dependents }` | `404` component not found |

### POST /api/components body

```json
{
  "id": "my-service",
  "name": "My Service",
  "type": "component",
  "layer": "supervisor-layer",
  "description": "Optional description",
  "tags": ["optional", "tags"]
}
```

Valid types: `layer`, `component`, `store`, `external`, `phase`, `app`.

### curl examples

```bash
# List components
curl https://roadmap-5vvp.onrender.com/api/components

# Get component details
curl https://roadmap-5vvp.onrender.com/api/components/worker

# Create a component
curl -X POST https://roadmap-5vvp.onrender.com/api/components \
  -H "Content-Type: application/json" \
  -d '{"id":"my-svc","name":"My Service","type":"component","layer":"supervisor-layer"}'

# Delete a component
curl -X DELETE https://roadmap-5vvp.onrender.com/api/components/my-svc

# List features
curl https://roadmap-5vvp.onrender.com/api/components/worker/features

# Upload a feature file
curl -X PUT https://roadmap-5vvp.onrender.com/api/components/worker/features/mvp-exec.feature \
  --data-binary @components/worker/features/mvp-exec.feature

# Delete a feature file
curl -X DELETE https://roadmap-5vvp.onrender.com/api/components/worker/features/mvp-exec.feature

# Get edges
curl https://roadmap-5vvp.onrender.com/api/components/worker/edges

# Get dependencies
curl https://roadmap-5vvp.onrender.com/api/components/worker/dependencies

# Full architecture export
curl https://roadmap-5vvp.onrender.com/api/architecture
```

## Adding New Features (BDD Workflow)

1. Create `features/new-feature.feature` with Gherkin scenarios
2. Run `npm run test:features` -- see RED
3. Create `tests/step-definitions/new-feature.steps.ts`
4. Create unit tests in `tests/unit/` for each layer
5. Implement Domain -> Use Cases -> Infrastructure -> Adapters
6. Run `npm test` -- see GREEN
7. Refactor while keeping tests green
8. Ship with `/ship` (or follow the manual shipping workflow below)

## Shipping Workflow (Post-Commit)

After all tests pass and work is complete, use the `/ship` command to automate the full delivery pipeline:

```
/ship
```

This runs the following steps automatically:

```
 1. PRE-FLIGHT           npm run pre-commit (all 7 gates must pass)
            |
 2. COMMIT               Stage changes + conventional commit message
            |
 3. PUSH                 git push -u origin <branch>
            |
 4. CREATE PR            gh pr create --title "..." --body "..."
            |
 5. ARCHITECTURE REVIEW  @architecture-reviewer leaves inline comments
            |
 6. SECURITY REVIEW      @security-reviewer leaves inline comments
            |
 7. PERFORMANCE REVIEW   @performance-reviewer leaves inline comments
            |
 8. ADDRESS FEEDBACK     For each comment from all three reviewers:
                          - Make the code fix
                          - Run lint + tests
                          - Commit the fix
                          - Resolve the comment on GitHub
            |
 9. PUSH FIXES           git push (all fix commits)
            |
10. DOCUMENTATION UPDATE @documentation-updater updates README.md
                          and AGENTS.md if needed, commits + pushes
            |
11. REPORT               PR URL + summary of all reviews and fixes
```

### Manual Shipping (without /ship)

If you prefer to do it step by step:

1. Run `npm run pre-commit` -- all gates must pass
2. `git add -A && git commit -m "<type>(<scope>): <description>"`
3. `git push -u origin <branch>`
4. `gh pr create --title "..." --body "## Summary ..."`
5. Invoke `@architecture-reviewer` with the PR number
6. Invoke `@security-reviewer` with the PR number
7. Invoke `@performance-reviewer` with the PR number
8. Address each comment, commit fixes, resolve comments
9. `git push`
10. Invoke `@documentation-updater` with the PR number
11. Commit and push any documentation changes

### PR Review Agents

All review agents follow the same pattern: read the PR diff, analyse against their checklist, and post inline comments on specific files and lines via the GitHub REST API.

#### Architecture Reviewer

The `architecture-reviewer` subagent (`.opencode/agents/architecture-reviewer.md`) checks:

- Clean Architecture boundary compliance (imports point inward)
- Code quality rules (complexity, depth, params, lines)
- Barrel exports, constructor injection, repository pattern
- Incomplete work markers and type safety bypasses
- Test coverage for new code
- Conventional commit format

#### Security Reviewer

The `security-reviewer` subagent (`.opencode/agents/security-reviewer.md`) checks:

- Injection vectors (SQL, XSS, command injection, path traversal, prototype pollution)
- Authentication and authorization gaps (missing middleware, scope checks, privilege escalation)
- Secrets exposure (hardcoded credentials, secrets in logs/errors/URLs/git)
- Cryptographic issues (weak hashing, hardcoded salts, insufficient randomness)
- Input validation (missing body validation, type coercion, size limits, ReDoS)

#### Performance Reviewer

The `performance-reviewer` subagent (`.opencode/agents/performance-reviewer.md`) checks:

- Algorithmic inefficiency (O(n^2) loops, N+1 queries, linear scans vs indexed lookup)
- Memory and resource management (event listener leaks, unbounded caches, connection leaks)
- I/O and database (synchronous I/O, missing pooling, unbatched writes, over-fetching)
- Caching opportunities (repeated queries, missing memoization, stale config reads)
- Concurrency and async (sequential awaits, blocking event loop, missing timeouts)

#### Documentation Updater

The `documentation-updater` subagent (`.opencode/agents/documentation-updater.md`) runs after code reviews are addressed:

- Reads the PR diff and determines if documentation needs updating
- Updates `README.md` and `AGENTS.md` for new endpoints, agents, commands, config, schema changes
- Does NOT update for bug fixes, refactors, or test-only changes
- Changes are committed and pushed to the PR branch

After any reviewer leaves inline comments, the LLM engineer addresses each one:

1. Read the inline comment (visible on the exact file/line in the PR)
2. Make the code change
3. Verify with `npm run lint && npm run test:unit`
4. Commit: `fix(<scope>): address review -- <what>`
5. Resolve the review thread via `gh api`

## OpenCode Configuration

### Agents

| Agent | Mode | Location | Purpose |
|-------|------|----------|---------|
| `architecture-reviewer` | subagent | `.opencode/agents/architecture-reviewer.md` | PR review for Clean Architecture and code quality |
| `security-reviewer` | subagent | `.opencode/agents/security-reviewer.md` | PR review for security vulnerabilities and auth gaps |
| `performance-reviewer` | subagent | `.opencode/agents/performance-reviewer.md` | PR review for algorithmic efficiency and resource management |
| `documentation-updater` | subagent | `.opencode/agents/documentation-updater.md` | Updates README.md and AGENTS.md after PR changes |

### Commands

| Command | Location | Purpose |
|---------|----------|---------|
| `/bdd` | `.opencode/commands/bdd.md` | Full BDD red-to-green TDD workflow with enforced phases |
| `/ship` | `.opencode/commands/ship.md` | Full delivery pipeline: commit, push, PR, review, fix |

Component and feature management is done via the REST API (see [REST API](#rest-api) section above). There are no separate slash commands for CRUD operations — the API endpoints table and curl examples serve as the reference.

### File Roles (OpenCode)

| File | Role | Edit? |
|------|------|-------|
| `.opencode/agents/*.md` | Subagent definitions | Yes -- add/edit agents |
| `.opencode/commands/*.md` | Custom slash commands | Yes -- add/edit commands |
