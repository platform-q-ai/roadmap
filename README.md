# Roadmap

Living documentation for the **Open Autonomous Runtime** architecture. Every component in the system is a node in a SQLite graph database with versioned specs (MVP / v1 / v2), Gherkin feature files, and progress tracking. A REST API provides full CRUD access to components, features, and the architecture graph. A static web view renders the full architecture as an interactive diagram where every box can be expanded to explore documentation, build status, and BDD specs.

**Live:** [roadmap-5vvp.onrender.com](https://roadmap-5vvp.onrender.com)

Built in the open.

## Architecture Overview

The runtime is an autonomous AI agent system built around two LLM-powered instances (a Meta-Agent planner and a Worker executor) orchestrated by a Supervisor process. The architecture spans 11 layers and 56 components:

| Layer | Purpose |
|-------|---------|
| Observability Dashboard | Live process view, tool call timeline, security events, entity explorer |
| Supervisor | Process manager, heartbeat, human gate, fast-path router |
| Task Router | Fast path (trivial), full path (complex), gated path (dangerous) |
| Knowledge Graphs | User domain context + code structure via tree-sitter |
| Dual OpenCode Instances | Meta-Agent (planner) + Worker (executor) with 14 MCP tools |
| Escalation Flow | Worker-to-human reverse communication |
| Shared State Store | Append-only SQLite/Postgres, checkpointer, context rebuilder |
| MCP Proxies | Static proxy for Meta-Agent, dynamic hot-swappable proxy for Worker |
| Security Sandbox | 3-stage sanitiser + alert pipeline |
| Downstream Tools | Search, email, database, filesystem, code execution, custom |
| BDD/TDD Pipeline | 8-phase pipeline: Feature, Steps, Units, Red, Green, Refactor, Arch Review, Sec Review |

## Quick Start

Prerequisites: Node.js (>=18).

```bash
git clone https://github.com/platform-q-ai/roadmap.git
cd roadmap
npm install
npm run build
```

This compiles TypeScript. The database is created and managed at runtime by the API server — there is no build-time seed process. The web view fetches live data from the `/api/architecture` endpoint.

### Serve the web view (static)

```bash
npm run serve
# Open http://localhost:8080
```

### Run the API server (local development)

```bash
npm run serve:api
# API:      http://localhost:3000/api/health
# Web view: http://localhost:3000/
```

## Repository Structure

The codebase follows Clean Architecture. Dependencies point inward: adapters -> use-cases -> domain.

```
roadmap/
├── schema.sql                  # SQLite graph schema (4 tables, 6 indexes)
├── seed.sql                    # All component data, edges, and version content
├── db/                         # Runtime database directory (gitignored)
├── src/
│   ├── domain/                 # Entities + repository interfaces (zero deps)
│   │   ├── entities/           # Node, Edge, Version, Feature
│   │   └── repositories/       # Abstract interfaces (contracts only)
│   ├── use-cases/              # Business logic (depends only on domain)
│   │   ├── get-architecture.ts
│   │   ├── export-architecture.ts
│   │   ├── get-step-totals.ts
│   │   ├── seed-features.ts
│   │   ├── create-component.ts
│   │   ├── delete-component.ts
│   │   ├── upload-feature.ts
│   │   ├── delete-feature.ts
│   │   ├── update-component.ts
│   │   ├── create-edge.ts
│   │   ├── delete-edge.ts
│   │   ├── batch-upload-features.ts
│   │   ├── delete-feature-version-scoped.ts
│   │   ├── get-feature-version-scoped.ts
│   │   ├── seed-features-api.ts
│   │   ├── export-features.ts
│   │   ├── get-dependency-tree.ts
│   │   ├── get-dependents.ts
│   │   ├── get-component-context.ts
│   │   ├── get-implementation-order.ts
│   │   ├── get-components-by-status.ts
│   │   ├── get-next-implementable.ts
│   │   ├── get-shortest-path.ts
│   │   ├── get-neighbourhood.ts
│   │   ├── get-layer-overview.ts
│   │   ├── list-layers.ts
│   │   ├── get-layer.ts
│   │   ├── create-layer.ts
│   │   ├── move-component.ts
│   │   └── errors.ts
│   ├── infrastructure/         # Concrete implementations
│   │   ├── drizzle/            # Drizzle ORM repositories (primary)
│   │   └── sqlite/             # Raw better-sqlite3 repositories (legacy)
│   └── adapters/               # Entry points
│       ├── api/                # REST API server (40 endpoints + static files)
│       └── cli/                # CLI commands (component CRUD)
├── components/                 # 50 component directories with Gherkin feature files
│   ├── roadmap/features/       # 72 feature files (self-tracking)
│   ├── supervisor/features/
│   ├── meta-agent/features/
│   ├── worker/features/
│   └── ...
├── features/                   # Top-level Cucumber feature files
├── tests/
│   ├── unit/                   # Vitest unit tests (90% coverage threshold)
│   └── step-definitions/       # Cucumber step implementations
├── web/
│   └── index.html              # Interactive web view (single file, Cytoscape.js)
├── scripts/
│   └── check-code-quality.sh   # 12-check code quality gate
├── Dockerfile                  # Production Docker image
├── render.yaml                 # Render deployment blueprint
└── AGENTS.md                   # Instructions for LLM maintainers
```

## How It Works

### Data Model

Everything lives in four SQLite tables:

- **nodes** -- 67 components (layers, components, apps, stores, external tools, pipeline phases). Each has an id, name, type, color, icon, description, and JSON tags array.
- **edges** -- 119 typed relationships (CONTAINS, CONTROLS, DEPENDS_ON, READS_FROM, WRITES_TO, DISPATCHES_TO, ESCALATES_TO, PROXIES, SANITISES, GATES, SEQUENCE).
- **node_versions** -- 105 versioned specs. Each component has overview, MVP, v1, and v2 documentation with progress (0-100%) and status (planned / in-progress / complete).
- **features** -- 83 Gherkin feature files linked to components and versions. Each feature tracks a `step_count` for progress aggregation.

### Data Flow

```
API server  ->  architecture.db (created at runtime via DB_PATH)
                       |
                 /api/architecture  ->  web view
```

The REST API creates and manages `architecture.db` at runtime using Drizzle ORM. There is no build-time seed process — the API is the sole source of truth. The web view fetches live data from the `/api/architecture` endpoint (public, no authentication required).

### Clean Architecture

New delivery mechanisms (API server, MCP server, VS Code extension) are added as adapters in `src/adapters/` that reuse existing use cases. The domain and use-case layers never change to support a new delivery mechanism.

```
Adapters (CLI, API, MCP)  ->  Use Cases  ->  Domain (entities + interfaces)
                                   |
                          Infrastructure (Drizzle ORM / SQLite)
```

### Web View

The interactive page fetches live data from the `/api/architecture` endpoint and renders the architecture as a layered diagram using Cytoscape.js with a dark theme. Each component box:

- Shows its description, progress badge, and tags when collapsed
- Expands on click to reveal a version toggle strip (MVP / v1 / v2)
- Displays the selected version's content with a progress bar
- Lists associated Gherkin feature files (expandable)

## REST API

The API server runs at `https://roadmap-5vvp.onrender.com` (production) or `http://localhost:3000` (local via `npm run serve:api`). All endpoints return JSON. The server also serves the static web view at the root path.

| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| `GET` | `/api/health` | Health check (public, no auth) | `200` | -- |
| `GET` | `/api/architecture` | Full architecture graph (public, no auth, `Cache-Control: public, max-age=30`) | `200` | -- |
| `GET` | `/api/components` | List all non-layer nodes | `200` | -- |
| `GET` | `/api/components/:id` | Component with versions and features | `200` | `404` |
| `POST` | `/api/components` | Create a new component (with validation) | `201` | `400` `409` |
| `PATCH` | `/api/components/:id` | Partial update (merge-patch semantics) | `200` | `400` `404` `413` |
| `DELETE` | `/api/components/:id` | Delete component + versions, features, edges | `204` | `404` |
| `GET` | `/api/components/:id/features` | List features for a component | `200` | `404` |
| `GET` | `/api/components/:id/versions/:ver/features` | List features for a specific version (with totals) | `200` | `404` |
| `GET` | `/api/components/:id/versions/:ver/features/:filename` | Get single feature (JSON or `text/plain` via Accept header) | `200` | `404` |
| `PUT` | `/api/components/:id/versions/:ver/features/:filename` | Upload/replace a feature file with Gherkin validation (raw Gherkin body) | `200` | `400` `404` |
| `PUT` | `/api/components/:id/features/:filename` | **Deprecated** — returns 400 directing to version-scoped URL | `—` | `400` |
| `DELETE` | `/api/components/:id/features/:filename` | Delete a feature file | `204` | `404` |
| `DELETE` | `/api/components/:id/versions/:ver/features/:filename` | Delete a single feature by version and filename | `204` | `404` |
| `DELETE` | `/api/components/:id/versions/:ver/features` | Delete all features for a specific version | `204` | `404` |
| `DELETE` | `/api/components/:id/features` | Delete all features for a component (all versions) | `204` | `404` |
| `GET` | `/api/components/:id/edges` | Inbound and outbound edges | `200` | `404` |
| `GET` | `/api/components/:id/dependencies` | Recursive DEPENDS_ON tree (optional `?depth=N`, default 1, max 10) | `200` | `404` |
| `GET` | `/api/components/:id/dependents` | Reverse DEPENDS_ON lookup | `200` | `404` |
| `GET` | `/api/components/:id/context` | Rich component context (versions, features, deps, dependents, layer, siblings, progress) | `200` | `404` |
| `GET` | `/api/components/:id/neighbourhood` | N-hop subgraph (optional `?hops=N`, default 1, max 5) | `200` | `404` |
| `GET` | `/api/graph/implementation-order` | Topological sort by DEPENDS_ON edges | `200` | `409` |
| `GET` | `/api/graph/components-by-status` | Classify components by step coverage (optional `?version=`) | `200` | -- |
| `GET` | `/api/graph/next-implementable` | Components ready to implement (all deps complete, optional `?version=`) | `200` | -- |
| `GET` | `/api/graph/path` | BFS shortest path (`?from=X&to=Y` required) | `200` | `400` |
| `GET` | `/api/graph/layer-overview` | Layer summaries with component counts and progress | `200` | -- |
| `GET` | `/api/layers` | List all layer nodes | `200` | -- |
| `GET` | `/api/layers/:id` | Get layer with its children | `200` | `404` |
| `POST` | `/api/layers` | Create a new layer (with validation) | `201` | `400` `409` |
| `POST` | `/api/edges` | Create a new edge (with validation) | `201` | `400` `409` |
| `GET` | `/api/edges` | List all edges (optional `?type=` filter, `?limit=`/`?offset=` pagination) | `200` | `400` |
| `DELETE` | `/api/edges/:id` | Delete an edge by numeric ID | `204` | `404` |
| `POST` | `/api/components/:id/versions/:ver/features/batch` | Batch upload up to 50 features for one component/version | `201` `207` | `400` `404` |
| `GET` | `/api/features/search` | Search feature content across all components (`?q=`, optional `?version=`) | `200` | `400` |
| `POST` | `/api/features/batch` | Cross-component batch upload up to 50 features | `201` `207` | `400` |
| `POST` | `/api/bulk/components` | Batch create up to 100 components | `201` `207` | `400` |
| `POST` | `/api/bulk/edges` | Batch create up to 100 edges (validates node refs) | `201` `207` | `400` |
| `POST` | `/api/bulk/delete/components` | Batch delete up to 100 components | `200` | `400` |
| `POST` | `/api/admin/seed-features` | Re-seed features from filesystem (admin scope) | `200` | `403` `500` |
| `POST` | `/api/admin/export-features` | Export features to filesystem (optional `?component=` filter, admin scope) | `200` | `400` `403` `500` |

### Example: Create a component

```bash
curl -X POST https://roadmap-5vvp.onrender.com/api/components \
  -H "Content-Type: application/json" \
  -d '{"id":"my-svc","name":"My Service","type":"component","layer":"supervisor-layer","color":"#3498DB","icon":"server","sort_order":10}'
```

Valid types: `layer`, `component`, `store`, `external`, `phase`, `app`, `mcp`.

The request body requires `id` (kebab-case, max 64 chars), `name` (non-empty), `type`, and `layer` (must reference an existing layer node). Optional fields: `description`, `tags`, `color`, `icon`, `sort_order`. All string inputs are HTML-sanitized. The `201` response returns the full node object with all fields.

### Example: Partially update a component

```bash
curl -X PATCH https://roadmap-5vvp.onrender.com/api/components/my-svc \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"name":"Renamed Service","description":"Updated description","tags":["new-tag"]}'
```

Updatable fields: `name` (non-empty string), `description` (string), `tags` (string array, max 50), `sort_order` (number), `current_version` (semver string, e.g. `"0.7.5"`), `layer` (string, must reference an existing layer node). Only supplied fields are changed; unmentioned fields are preserved. When `current_version` changes, all phase version records are automatically recalculated. When `layer` changes, the component is moved to the new layer and the CONTAINS edge is re-wired. All string inputs are HTML-sanitized. The `200` response returns the full updated node object.

### Example: Upload a feature file (version-scoped)

```bash
curl -X PUT https://roadmap-5vvp.onrender.com/api/components/worker/versions/mvp/features/mvp-exec.feature \
  --data-binary @components/worker/features/mvp-task-execution.feature
```

The request body must be valid Gherkin text. The endpoint validates: filename must end with `.feature` and be kebab-case; content must not be empty; content must contain a `Feature:` line, at least one `Scenario:`, and at least one step (`Given`/`When`/`Then`); syntax errors are detected with line numbers. All validation failures return `400` with a descriptive error message. The response includes `filename`, `version`, `title`, `node_id`, `step_count`, `scenario_count`, `given_count`, `when_count`, and `then_count`. The version must be `mvp`, `v1`, `v2`, etc. The old URL pattern (`PUT /api/components/:id/features/:filename`) now returns `400` directing callers to the version-scoped URL.

### Example: List features by version

```bash
# List features for a specific version (returns features array + totals)
curl https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features

# Get a single feature as JSON
curl https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features/v1-test.feature

# Get a single feature as raw Gherkin text
curl -H "Accept: text/plain" \
  https://roadmap-5vvp.onrender.com/api/components/worker/versions/v1/features/v1-test.feature
```

The list endpoint returns `{ features: [...], totals: { total_features, total_scenarios, total_steps, total_given_steps, total_when_steps, total_then_steps } }`. The single-feature endpoint returns the feature object as JSON by default, or raw Gherkin text when the `Accept: text/plain` header is sent.

### Example: Create an edge

```bash
curl -X POST https://roadmap-5vvp.onrender.com/api/edges \
  -H "Content-Type: application/json" \
  -d '{"source_id":"comp-a","target_id":"comp-b","type":"DEPENDS_ON"}'
```

Required: `source_id`, `target_id` (must reference existing nodes), `type` (valid edge type). Optional: `label` (max 500 chars), `metadata` (JSON object, max 4 KB). Self-referencing edges are rejected. Duplicate edges (same source, target, type) return `409`.

### Example: Search features

```bash
# Search feature content across all components
curl "https://roadmap-5vvp.onrender.com/api/features/search?q=authentication"

# Search scoped to a specific version
curl "https://roadmap-5vvp.onrender.com/api/features/search?q=rate+limiting&version=v1"
```

Returns an array of matching features. Each result includes `node_id`, `filename`, `version`, `title`, `step_count`, and a `snippet` field showing context around the match. The full `content` field is excluded to keep payloads small. The `q` parameter is required (max 200 characters). Results are capped at 100.

### Example: List and filter edges

```bash
# List all edges
curl https://roadmap-5vvp.onrender.com/api/edges

# Filter by type
curl "https://roadmap-5vvp.onrender.com/api/edges?type=DEPENDS_ON"

# With pagination (default limit 1000)
curl "https://roadmap-5vvp.onrender.com/api/edges?limit=50&offset=0"

# Delete an edge
curl -X DELETE https://roadmap-5vvp.onrender.com/api/edges/42
```

### Example: Admin feature seeding and export

```bash
# Re-seed features from filesystem (requires admin API key)
curl -X POST https://roadmap-5vvp.onrender.com/api/admin/seed-features \
  -H "Authorization: Bearer <admin-api-key>"

# Export all features to filesystem
curl -X POST https://roadmap-5vvp.onrender.com/api/admin/export-features \
  -H "Authorization: Bearer <admin-api-key>"

# Export features for a single component
curl -X POST "https://roadmap-5vvp.onrender.com/api/admin/export-features?component=worker" \
  -H "Authorization: Bearer <admin-api-key>"
```

The seed endpoint scans `components/**/features/*.feature` files, parses version from filename prefix (`mvp-`, `v1-`, `v2-`), and inserts them into the database. The response includes `seeded` count, `skipped` count, and `step_totals` per version. The export endpoint writes features from the database back to the filesystem. Both require an API key with `admin` scope.

### Example: Layer management

```bash
# List all layers
curl https://roadmap-5vvp.onrender.com/api/layers

# Get a layer with its children
curl https://roadmap-5vvp.onrender.com/api/layers/supervisor-layer

# Create a new layer
curl -X POST https://roadmap-5vvp.onrender.com/api/layers \
  -H "Content-Type: application/json" \
  -d '{"id":"new-layer","name":"New Layer","color":"#E74C3C","icon":"layers","description":"A new layer","sort_order":42}'

# Move a component to a different layer
curl -X PATCH https://roadmap-5vvp.onrender.com/api/components/my-svc \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"layer":"new-layer"}'
```

The `POST /api/layers` endpoint requires `id` (kebab-case, max 64 chars) and `name` (non-empty). Optional fields: `color`, `icon`, `description`, `sort_order`. The `type` is automatically set to `layer`. Duplicate IDs return `409`. The `GET /api/layers/:id` response includes a `children` array of components contained in that layer.

## Edge Types

| Type | Meaning |
|------|---------|
| `CONTAINS` | Layer/group contains component |
| `CONTROLS` | Process/lifecycle control |
| `DEPENDS_ON` | Runtime dependency |
| `READS_FROM` | Data flow: read |
| `WRITES_TO` | Data flow: write |
| `DISPATCHES_TO` | Task/command flow |
| `ESCALATES_TO` | Reverse communication |
| `PROXIES` | Indirection layer |
| `SANITISES` | Security boundary |
| `GATES` | Human approval boundary |
| `SEQUENCE` | Ordered pipeline step |

## Common Tasks

### Add a new feature file

Upload via the API:

```bash
curl -X PUT https://roadmap-5vvp.onrender.com/api/components/supervisor/versions/mvp/features/mvp-health-api.feature \
  --data-binary @components/supervisor/features/mvp-health-api.feature
```

Optionally keep a local copy in `components/<id>/features/` for reference.

### Add a new component

```bash
curl -X POST https://roadmap-5vvp.onrender.com/api/components \
  -H "Content-Type: application/json" \
  -d '{"id":"my-svc","name":"My Service","type":"component","layer":"supervisor-layer","description":"Optional","tags":["optional"],"color":"#3498DB","icon":"server","sort_order":5}'
```

See [AGENTS.md](AGENTS.md) for detailed instructions and schema reference.

## Quality Gates

A 7-step pre-commit pipeline runs automatically on every commit via Husky:

| Step | Gate |
|------|------|
| 1 | `check:code-quality` -- 12-check script (markers, type safety, barrels, boundaries, dead code, BDD, knip, dep-cruiser) |
| 2 | `lint` -- ESLint with `eslint-plugin-boundaries` for Clean Architecture enforcement |
| 3 | `format:check` -- Prettier |
| 4 | `typecheck` -- TypeScript (`tsc --noEmit`) |
| 5 | `build:ts` -- TypeScript compilation |
| 6 | `test:coverage` -- Vitest unit tests with 90% coverage thresholds |
| 7 | `test:features` -- Cucumber BDD scenarios |

GitHub Actions runs the same pipeline on every PR targeting `master`, plus a check for unresolved review comments.

## Deployment

The application is deployed on Render as a Docker-based web service. On every push to `master`, Render automatically builds the Docker image (Node 22) and deploys the API server, which also serves the static web view.

**Live URL:** https://roadmap-5vvp.onrender.com

The Render blueprint (`render.yaml`) defines the service configuration including a 1 GB persistent disk mounted at `/data`. The `Dockerfile` compiles TypeScript only (`npm run build:ts`) — it does not rebuild the database or seed features at build time. The database is created and managed at runtime via the API (API-first persistence). The `DB_PATH` environment variable points to `/data/architecture.db` so that data survives redeployments. The production server uses `node dist/adapters/api/start.js`.

## Tech Stack

- **SQLite** + **Drizzle ORM** (+ better-sqlite3) -- graph database backend with type-safe queries
- **Node.js** + **TypeScript** (ESM) -- Clean Architecture application layer
- **Vanilla HTML/CSS/JS** + **Cytoscape.js** -- interactive web view, zero frameworks
- **Gherkin** + **Cucumber.js** -- BDD feature specs per component
- **Vitest** -- unit testing with 90% coverage thresholds
- **ESLint** + **eslint-plugin-boundaries** -- linting with Clean Architecture enforcement
- **Prettier** -- code formatting
- **Husky** + **lint-staged** -- pre-commit hooks
- **knip** -- dead code / unused export detection
- **dependency-cruiser** -- architectural boundary validation
- **Docker** + **Render** -- containerised deployment with auto-deploy from `master`
- **GitHub Actions** -- PR quality gate (lint, test, coverage, review comments)

## Commands

```bash
npm install              # Install dependencies
npm run build            # TypeScript compile (alias for build:ts)
npm run build:ts         # TypeScript compile only
npm run start            # Start production API server
npm run serve            # Serve static web view on port 8080
npm run serve:api        # Start API server in development (tsx)

npm test                 # Unit + feature tests
npm run test:unit        # Vitest unit tests
npm run test:unit:watch  # Vitest watch mode
npm run test:coverage    # Vitest with 90% coverage thresholds
npm run test:features    # Cucumber BDD scenarios

npm run typecheck        # TypeScript type check (tsc --noEmit)
npm run lint             # ESLint (includes boundary checks)
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run check:code-quality  # 12-check code quality script
npm run check:knip       # knip (unused exports/dependencies)
npm run check:deps       # dependency-cruiser (architecture validation)
npm run pre-commit       # Full 7-step pre-commit pipeline
```
