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

Living documentation for the Open Autonomous Runtime. The source of truth is a SQLite database (`db/architecture.db`) managed at runtime via the REST API. The web view (`web/index.html`) is a read-only page that fetches live data from the `/api/architecture` endpoint (no authentication required).

**Do not edit `db/architecture.db` directly.** It is created and managed at runtime by the API server. Edit `schema.sql` for schema reference, `web/index.html` for UI changes.

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
│   ├── update-component.ts     # Partial update (merge-patch) with version recalc
│   ├── create-edge.ts          # Create edge with validation (type, self-ref, duplicates)
│   ├── delete-edge.ts          # Delete edge by ID with existence check
│   ├── batch-upload-features.ts # Batch upload features (single + cross-component)
│   ├── delete-feature-version-scoped.ts # Version-scoped feature deletion (single, version, all)
│   ├── get-feature-version-scoped.ts # Version-scoped feature retrieval with totals
│   ├── search-features.ts      # Search feature content across all components
│   ├── seed-features-api.ts    # API-triggered feature seeding with step totals
│   ├── export-features.ts      # Export features from DB to filesystem
│   ├── get-dependency-tree.ts  # Recursive DEPENDS_ON tree traversal
│   ├── get-dependents.ts       # Reverse DEPENDS_ON lookup
│   ├── get-component-context.ts # Rich component context aggregation
│   ├── get-implementation-order.ts # Topological sort with cycle detection
│   ├── get-components-by-status.ts # Classify components by step coverage
│   ├── get-next-implementable.ts # Ready-to-implement components
│   ├── get-shortest-path.ts    # BFS shortest path between nodes
│   ├── get-neighbourhood.ts    # N-hop subgraph extraction
│   ├── get-layer-overview.ts   # Layer summaries with progress
│   ├── list-layers.ts          # List all layer nodes
│   ├── get-layer.ts            # Get layer with children
│   ├── create-layer.ts         # Create a new layer node
│   ├── move-component.ts       # Move component between layers (re-wire CONTAINS edge)
│   └── index.ts                # Layer barrel export
├── infrastructure/             # Concrete implementations
│   └── sqlite/                 # better-sqlite3 repository implementations
│       ├── connection.ts       # Database connection factory
│       ├── node-repository.ts
│       ├── edge-repository.ts
│       ├── version-repository.ts
│       ├── feature-repository.ts
│       └── index.ts            # Barrel export
└── adapters/                   # Entry points (CLI, API)
    └── cli/
        ├── component-create.ts # Create component via CLI
        └── component-delete.ts # Delete component via CLI
```

Data flow:

```
API server  -->  architecture.db (created at runtime via DB_PATH)
                       |
                 /api/architecture  -->  web view
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
// src/adapters/api/start.ts — adapter wires deps
const getArchitecture = new GetArchitecture({
  nodeRepo: new DrizzleNodeRepository(db),
  edgeRepo: new DrizzleEdgeRepository(db),
  versionRepo: new DrizzleVersionRepository(db),
  featureRepo: new DrizzleFeatureRepository(db),
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
npm run build            # TypeScript compile (alias for build:ts)
npm run build:ts         # TypeScript compile only
npm run start            # Start production API server
npm run serve            # Serve web view locally on port 8080
npm run serve:api        # Start API server in development (tsx)

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
| `schema.sql` | Database schema reference (4 tables) | Yes -- structural changes |
| `src/domain/entities/*.ts` | Domain entities (Node, Edge, Version, Feature) | Yes -- data model changes |
| `src/domain/repositories/*.ts` | Repository interfaces (contracts) | Yes -- new queries |
| `src/use-cases/*.ts` | Business logic | Yes -- new operations |
| `src/infrastructure/sqlite/*.ts` | SQLite implementations | Yes -- query changes |
| `src/adapters/cli/*.ts` | CLI entry points (component CRUD) | Yes -- CLI changes |
| `src/adapters/api/*.ts` | REST API server | Yes -- API changes |
| `web/index.html` | Interactive web view (single file) | Yes -- UI changes |
| `components/*/features/*.feature` | Gherkin feature files per component | Yes -- add/edit specs |
| `eslint.config.js` | ESLint + boundary rules | Yes -- rule changes |
| `tsconfig.json` | TypeScript config | Rarely |
| `vitest.config.ts` | Vitest config | Rarely |
| `scripts/check-code-quality.sh` | Code quality gate | Yes -- add new checks |
| `Dockerfile` | Production Docker image (TypeScript compile only, no DB build) | Yes -- deployment changes |
| `render.yaml` | Render deployment blueprint (persistent disk, DB_PATH) | Yes -- deployment config |

## How to Add a New Component

1. Create the component via the API: `POST /api/components`
2. Create edges via the API: `POST /api/edges`
3. Upload feature files via the API: `PUT /api/components/:id/versions/:ver/features/:filename`
4. Optionally create `components/<id>/features/` directory with Gherkin files for local reference

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

All endpoints return JSON. Mutating endpoints accept JSON bodies (except `PUT /api/components/:id/versions/:ver/features/:filename` which accepts raw Gherkin text).

### Endpoints

| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| `GET` | `/api/health` | Health check (public, no auth) | `200 { status: "ok" }` | — |
| `GET` | `/api/architecture` | Full architecture graph (public, no auth, `Cache-Control: public, max-age=30`) | `200` | — |
| `GET` | `/api/components` | List all non-layer nodes | `200 [...]` | — |
| `GET` | `/api/components/:id` | Get component with versions and features | `200` | `404` not found |
| `POST` | `/api/components` | Create a new component (with validation) | `201` | `400` invalid, `409` duplicate |
| `PATCH` | `/api/components/:id` | Partial update (merge-patch semantics) | `200` | `400` invalid, `404` not found, `413` body too large |
| `DELETE` | `/api/components/:id` | Delete component + versions, features, edges | `204` | `404` not found |
| `GET` | `/api/components/:id/features` | List features for a component | `200 [...]` | `404` component not found |
| `GET` | `/api/components/:id/versions/:ver/features` | List features for a specific version (with totals) | `200 { features, totals }` | `404` component not found |
| `GET` | `/api/components/:id/versions/:ver/features/:filename` | Get single feature (JSON or `text/plain` via Accept header) | `200` | `404` not found |
| `PUT` | `/api/components/:id/versions/:ver/features/:filename` | Upload/replace a feature file with Gherkin validation (body = raw Gherkin text) | `200` | `400` invalid filename/content/Gherkin, `404` component not found |
| `PUT` | `/api/components/:id/features/:filename` | **Deprecated** — returns 400 directing to version-scoped URL | `—` | `400` version is required |
| `DELETE` | `/api/components/:id/features/:filename` | Delete a single feature file | `204` | `404` not found |
| `DELETE` | `/api/components/:id/versions/:ver/features/:filename` | Delete a single feature by version and filename | `204` | `404` not found |
| `DELETE` | `/api/components/:id/versions/:ver/features` | Delete all features for a specific version | `204` | `404` component not found |
| `DELETE` | `/api/components/:id/features` | Delete all features for a component (all versions) | `204` | `404` component not found |
| `GET` | `/api/components/:id/edges` | Get inbound and outbound edges | `200 { inbound, outbound }` | `404` component not found |
| `GET` | `/api/components/:id/dependencies` | Recursive DEPENDS_ON tree (optional `?depth=N`, default 1, max 10) | `200 { dependencies }` | `404` component not found |
| `GET` | `/api/components/:id/dependents` | Reverse DEPENDS_ON lookup (components that depend on this one) | `200 [...]` | `404` component not found |
| `GET` | `/api/components/:id/context` | Rich component context (versions, features, deps, dependents, layer, siblings, progress) | `200` | `404` component not found |
| `GET` | `/api/components/:id/neighbourhood` | N-hop subgraph (optional `?hops=N`, default 1, max 5) | `200 { nodes, edges }` | `404` component not found |
| `GET` | `/api/graph/implementation-order` | Topological sort of components by DEPENDS_ON edges | `200 [...]` | `409` cycle detected |
| `GET` | `/api/graph/components-by-status` | Classify components by step coverage (optional `?version=`, default `mvp`) | `200 { complete, in_progress, planned }` | — |
| `GET` | `/api/graph/next-implementable` | Components ready to implement (all deps complete, optional `?version=`, default `mvp`) | `200 [...]` | — |
| `GET` | `/api/graph/path` | BFS shortest path between two nodes (`?from=X&to=Y` required) | `200 { path, edges }` | `400` missing params |
| `GET` | `/api/graph/layer-overview` | Layer summaries with component counts and progress | `200 [...]` | — |
| `GET` | `/api/layers` | List all layer nodes | `200 [...]` | — |
| `GET` | `/api/layers/:id` | Get layer with its children | `200` | `404` not found |
| `POST` | `/api/layers` | Create a new layer (with validation) | `201` | `400` invalid, `409` duplicate |
| `POST` | `/api/edges` | Create a new edge (with validation) | `201` | `400` invalid type/self-ref/missing nodes, `409` duplicate |
| `GET` | `/api/edges` | List all edges (optional `?type=` filter, `?limit=`/`?offset=` pagination) | `200 [...]` | `400` invalid type filter |
| `DELETE` | `/api/edges/:id` | Delete an edge by numeric ID | `204` | `404` not found |
| `POST` | `/api/components/:id/versions/:ver/features/batch` | Batch upload up to 50 features for one component/version | `201` all uploaded, `207` partial | `400` empty/over limit/invalid, `404` component not found |
| `GET` | `/api/features/search` | Search feature content across all components (query: `?q=`, optional `?version=`, max 100 results) | `200 [...]` | `400` missing/empty/too-long query |
| `POST` | `/api/features/batch` | Cross-component batch upload up to 50 features (each entry specifies node_id + version) | `201` all uploaded, `207` partial | `400` empty/over limit/missing fields |
| `POST` | `/api/bulk/components` | Batch create up to 100 components | `201` all created, `207` partial | `400` invalid body or limit exceeded |
| `POST` | `/api/bulk/edges` | Batch create up to 100 edges (validates node refs) | `201` all created, `207` partial | `400` invalid body or limit exceeded |
| `POST` | `/api/bulk/delete/components` | Batch delete up to 100 components | `200` | `400` invalid body or limit exceeded |
| `POST` | `/api/admin/seed-features` | Re-seed features from filesystem (admin scope) | `200` | `403` forbidden, `500` internal |
| `POST` | `/api/admin/export-features` | Export features to filesystem (optional `?component=` filter, admin scope) | `200` | `400` invalid component, `403` forbidden, `500` internal |

### POST /api/components body

```json
{
  "id": "my-service",
  "name": "My Service",
  "type": "component",
  "layer": "supervisor-layer",
  "description": "Optional description",
  "tags": ["optional", "tags"],
  "color": "#3498DB",
  "icon": "server",
  "sort_order": 42
}
```

Required: `id` (kebab-case, max 64 chars), `name` (non-empty), `type`, `layer` (must reference an existing layer node). Optional: `description` (supports Markdown formatting), `tags`, `color`, `icon`, `sort_order`. All string inputs are HTML-sanitized (HTML tags are stripped, Markdown syntax is preserved). Returns the full node object (all fields) in the `201` response.

Valid types: `layer`, `component`, `store`, `external`, `phase`, `app`, `mcp`.

### PATCH /api/components/:id body

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "tags": ["new", "tags"],
  "sort_order": 99,
  "current_version": "0.7.5",
  "layer": "new-layer"
}
```

All fields are optional. Only supplied fields are changed; unmentioned fields are preserved (merge-patch semantics). `name` must be non-empty if provided. `description` supports Markdown formatting. `tags` is capped at 50 entries. `current_version` must be a valid semver string (`MAJOR.MINOR` or `MAJOR.MINOR.PATCH`). When `current_version` changes, all phase version records are automatically recalculated. `layer` must reference an existing layer node; when changed, the component is moved to the new layer and the CONTAINS edge is re-wired automatically. All string inputs are HTML-sanitized (HTML tags are stripped, Markdown syntax is preserved). Returns the full updated node object in the `200` response.

### POST /api/edges body

```json
{
  "source_id": "comp-a",
  "target_id": "comp-b",
  "type": "DEPENDS_ON",
  "label": "optional label",
  "metadata": {"optional": "JSON object"}
}
```

Required: `source_id` (must reference an existing node), `target_id` (must reference an existing node), `type` (must be a valid edge type). Optional: `label` (max 500 chars), `metadata` (JSON object, max 4 KB, max depth 4). Self-referencing edges (`source_id === target_id`) are rejected. Duplicate edges (same source, target, type) return `409`. All string inputs are HTML-sanitized. Returns the full edge object (with generated `id`) in the `201` response.

### POST /api/components/:id/versions/:ver/features/batch body

```json
{
  "features": [
    {
      "filename": "first.feature",
      "content": "Feature: First\n  Scenario: S1\n    Given a step"
    },
    {
      "filename": "second.feature",
      "content": "Feature: Second\n  Scenario: S2\n    Given a step"
    }
  ]
}
```

Required: `features` (non-empty array, max 50 entries). Each entry requires `filename` (no path separators or `..`) and `content` (valid Gherkin with a `Feature:` line). The component `:id` and version `:ver` are taken from the URL. Returns `{ uploaded, version, total_steps, errors }`. On partial failure, returns `207` with successfully uploaded features and an `errors` array describing each failure.

### POST /api/features/batch body

```json
{
  "features": [
    {
      "node_id": "comp-a",
      "version": "v1",
      "filename": "a.feature",
      "content": "Feature: A\n  Scenario: S\n    Given a step"
    },
    {
      "node_id": "comp-b",
      "version": "v2",
      "filename": "b.feature",
      "content": "Feature: B\n  Scenario: S\n    Given a step"
    }
  ]
}
```

Required: `features` (non-empty array, max 50 entries). Each entry requires `node_id` (must reference an existing component), `version`, `filename` (no path separators or `..`), and `content` (valid Gherkin). Returns `{ uploaded, total_steps, errors }`. Non-existent components are reported per-entry in the `errors` array (returns `207`), not as a top-level `404`.

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

# Partially update a component
curl -X PATCH https://roadmap-5vvp.onrender.com/api/components/my-svc \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"name":"Renamed","description":"Updated description","tags":["new-tag"]}'

# Delete a component
curl -X DELETE https://roadmap-5vvp.onrender.com/api/components/my-svc

# List features
curl https://roadmap-5vvp.onrender.com/api/components/worker/features

# List features for a specific version (with totals)
curl https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features

# Get a single feature by version and filename (JSON)
curl https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features/v1-test.feature

# Get a single feature as raw Gherkin text
curl -H "Accept: text/plain" \
  https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features/v1-test.feature

# Upload a feature file (version-scoped)
curl -X PUT https://roadmap-5vvp.onrender.com/api/components/worker/versions/mvp/features/mvp-exec.feature \
  --data-binary @components/worker/features/mvp-exec.feature

# Delete a feature file
curl -X DELETE https://roadmap-5vvp.onrender.com/api/components/worker/features/mvp-exec.feature

# Delete a single feature by version and filename
curl -X DELETE https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features/v1-test.feature

# Delete all features for a specific version
curl -X DELETE https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features

# Delete all features for a component (all versions)
curl -X DELETE https://roadmap-5vvp.onrender.com/api/components/worker/features

# Get edges
curl https://roadmap-5vvp.onrender.com/api/components/worker/edges

# Get dependency tree (recursive, default depth=1)
curl https://roadmap-5vvp.onrender.com/api/components/worker/dependencies

# Get dependency tree with depth
curl "https://roadmap-5vvp.onrender.com/api/components/worker/dependencies?depth=3"

# Get reverse dependencies (who depends on this component)
curl https://roadmap-5vvp.onrender.com/api/components/worker/dependents

# Get rich component context (versions, features, deps, layer, siblings, progress)
curl https://roadmap-5vvp.onrender.com/api/components/worker/context

# Get component neighbourhood (N-hop subgraph)
curl "https://roadmap-5vvp.onrender.com/api/components/worker/neighbourhood?hops=2"

# Get implementation order (topological sort)
curl https://roadmap-5vvp.onrender.com/api/graph/implementation-order

# Get components by completion status
curl "https://roadmap-5vvp.onrender.com/api/graph/components-by-status?version=mvp"

# Get next implementable components (all deps complete)
curl "https://roadmap-5vvp.onrender.com/api/graph/next-implementable?version=mvp"

# Get shortest path between two components
curl "https://roadmap-5vvp.onrender.com/api/graph/path?from=worker&to=supervisor"

# Get layer overview (summaries with progress)
curl https://roadmap-5vvp.onrender.com/api/graph/layer-overview

# List all layers
curl https://roadmap-5vvp.onrender.com/api/layers

# Get a layer with its children
curl https://roadmap-5vvp.onrender.com/api/layers/supervisor-layer

# Create a new layer
curl -X POST https://roadmap-5vvp.onrender.com/api/layers \
  -H "Content-Type: application/json" \
  -d '{"id":"new-layer","name":"New Layer","color":"#E74C3C","icon":"layers"}'

# Move a component to a different layer
curl -X PATCH https://roadmap-5vvp.onrender.com/api/components/my-svc \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"layer":"new-layer"}'

# Full architecture export
curl https://roadmap-5vvp.onrender.com/api/architecture

# Create an edge
curl -X POST https://roadmap-5vvp.onrender.com/api/edges \
  -H "Content-Type: application/json" \
  -d '{"source_id":"comp-a","target_id":"comp-b","type":"DEPENDS_ON"}'

# List all edges
curl https://roadmap-5vvp.onrender.com/api/edges

# List edges filtered by type
curl "https://roadmap-5vvp.onrender.com/api/edges?type=DEPENDS_ON"

# List edges with pagination
curl "https://roadmap-5vvp.onrender.com/api/edges?limit=50&offset=0"

# Delete an edge
curl -X DELETE https://roadmap-5vvp.onrender.com/api/edges/42

# Batch upload features for a single component/version
curl -X POST https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features/batch \
  -H "Content-Type: application/json" \
  -d '{"features":[{"filename":"first.feature","content":"Feature: First\n  Scenario: S1\n    Given a step"},{"filename":"second.feature","content":"Feature: Second\n  Scenario: S2\n    Given a step"}]}'

# Search feature content across all components
curl "https://roadmap-5vvp.onrender.com/api/features/search?q=authentication"

# Search features scoped to a specific version
curl "https://roadmap-5vvp.onrender.com/api/features/search?q=rate+limiting&version=v1"

# Cross-component batch upload features
curl -X POST https://roadmap-5vvp.onrender.com/api/features/batch \
  -H "Content-Type: application/json" \
  -d '{"features":[{"node_id":"worker","version":"v1","filename":"a.feature","content":"Feature: A\n  Scenario: S\n    Given a step"},{"node_id":"supervisor","version":"v2","filename":"b.feature","content":"Feature: B\n  Scenario: S\n    Given a step"}]}'

# Bulk create components
curl -X POST https://roadmap-5vvp.onrender.com/api/bulk/components \
  -H "Content-Type: application/json" \
  -d '{"components":[{"id":"svc-a","name":"Service A","type":"component","layer":"supervisor-layer"},{"id":"svc-b","name":"Service B","type":"component","layer":"supervisor-layer"}]}'

# Bulk create edges
curl -X POST https://roadmap-5vvp.onrender.com/api/bulk/edges \
  -H "Content-Type: application/json" \
  -d '{"edges":[{"source_id":"svc-a","target_id":"svc-b","type":"DEPENDS_ON"}]}'

# Bulk delete components
curl -X POST https://roadmap-5vvp.onrender.com/api/bulk/delete/components \
  -H "Content-Type: application/json" \
  -d '{"ids":["svc-a","svc-b"]}'

# Re-seed features from filesystem (admin scope)
curl -X POST https://roadmap-5vvp.onrender.com/api/admin/seed-features \
  -H "Authorization: Bearer <admin-api-key>"

# Export features to filesystem (admin scope)
curl -X POST https://roadmap-5vvp.onrender.com/api/admin/export-features \
  -H "Authorization: Bearer <admin-api-key>"

# Export features for a single component
curl -X POST "https://roadmap-5vvp.onrender.com/api/admin/export-features?component=worker" \
  -H "Authorization: Bearer <admin-api-key>"
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
