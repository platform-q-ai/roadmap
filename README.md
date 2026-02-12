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

Prerequisites: `sqlite3` CLI and Node.js (>=18).

```bash
git clone https://github.com/platform-q-ai/roadmap.git
cd roadmap
npm install
npm run build
```

This compiles TypeScript, rebuilds the database, seeds feature files, and exports `web/data.json`.

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
├── db/
│   └── architecture.db         # Built SQLite database (generated)
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
│   │   └── errors.ts
│   ├── infrastructure/         # Concrete implementations
│   │   ├── drizzle/            # Drizzle ORM repositories (primary)
│   │   └── sqlite/             # Raw better-sqlite3 repositories (legacy)
│   └── adapters/               # Entry points
│       ├── api/                # REST API server (19 endpoints + static files)
│       └── cli/                # CLI commands (export, seed-features, component CRUD)
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
│   ├── index.html              # Interactive web view (single file, Cytoscape.js)
│   └── data.json               # Exported data (generated)
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
seed.sql + schema.sql  ->  sqlite3  ->  architecture.db
                                              |
components/**/features/*.feature  ->  seed-features  ->  architecture.db
                                                               |
                                                         export  ->  data.json  ->  web view
```

The REST API also reads from and writes to `architecture.db` directly using Drizzle ORM.

### Clean Architecture

New delivery mechanisms (API server, MCP server, VS Code extension) are added as adapters in `src/adapters/` that reuse existing use cases. The domain and use-case layers never change to support a new delivery mechanism.

```
Adapters (CLI, API, MCP)  ->  Use Cases  ->  Domain (entities + interfaces)
                                   |
                          Infrastructure (Drizzle ORM / SQLite)
```

### Web View

The interactive page renders the architecture as a layered diagram using Cytoscape.js with a dark theme. Each component box:

- Shows its description, progress badge, and tags when collapsed
- Expands on click to reveal a version toggle strip (MVP / v1 / v2)
- Displays the selected version's content with a progress bar
- Lists associated Gherkin feature files (expandable)

## REST API

The API server runs at `https://roadmap-5vvp.onrender.com` (production) or `http://localhost:3000` (local via `npm run serve:api`). All endpoints return JSON. The server also serves the static web view at the root path.

| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| `GET` | `/api/health` | Health check | `200` | -- |
| `GET` | `/api/architecture` | Full architecture graph (layers, nodes, edges, stats) | `200` | -- |
| `GET` | `/api/components` | List all non-layer nodes | `200` | -- |
| `GET` | `/api/components/:id` | Component with versions and features | `200` | `404` |
| `POST` | `/api/components` | Create a new component (with validation) | `201` | `400` `409` |
| `PATCH` | `/api/components/:id` | Partial update (merge-patch semantics) | `200` | `400` `404` `413` |
| `DELETE` | `/api/components/:id` | Delete component + versions, features, edges | `204` | `404` |
| `GET` | `/api/components/:id/features` | List features for a component | `200` | `404` |
| `PUT` | `/api/components/:id/features/:filename` | Upload/replace a feature file (raw Gherkin body) | `200` | `404` |
| `DELETE` | `/api/components/:id/features/:filename` | Delete a feature file | `204` | `404` |
| `GET` | `/api/components/:id/edges` | Inbound and outbound edges | `200` | `404` |
| `GET` | `/api/components/:id/dependencies` | DEPENDS_ON edges (dependencies + dependents) | `200` | `404` |
| `POST` | `/api/edges` | Create a new edge (with validation) | `201` | `400` `409` |
| `GET` | `/api/edges` | List all edges (optional `?type=` filter, `?limit=`/`?offset=` pagination) | `200` | `400` |
| `DELETE` | `/api/edges/:id` | Delete an edge by numeric ID | `204` | `404` |
| `POST` | `/api/components/:id/versions/:ver/features/batch` | Batch upload up to 50 features for one component/version | `201` `207` | `400` `404` |
| `POST` | `/api/features/batch` | Cross-component batch upload up to 50 features | `201` `207` | `400` |
| `POST` | `/api/bulk/components` | Batch create up to 100 components | `201` `207` | `400` |
| `POST` | `/api/bulk/edges` | Batch create up to 100 edges (validates node refs) | `201` `207` | `400` |
| `POST` | `/api/bulk/delete/components` | Batch delete up to 100 components | `200` | `400` |

### Example: Create a component

```bash
curl -X POST https://roadmap-5vvp.onrender.com/api/components \
  -H "Content-Type: application/json" \
  -d '{"id":"my-svc","name":"My Service","type":"component","layer":"supervisor-layer","color":"#3498DB","icon":"server","sort_order":10}'
```

Valid types: `layer`, `component`, `store`, `external`, `phase`, `app`.

The request body requires `id` (kebab-case, max 64 chars), `name` (non-empty), `type`, and `layer` (must reference an existing layer node). Optional fields: `description`, `tags`, `color`, `icon`, `sort_order`. All string inputs are HTML-sanitized. The `201` response returns the full node object with all fields.

### Example: Partially update a component

```bash
curl -X PATCH https://roadmap-5vvp.onrender.com/api/components/my-svc \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"name":"Renamed Service","description":"Updated description","tags":["new-tag"]}'
```

Updatable fields: `name` (non-empty string), `description` (string), `tags` (string array, max 50), `sort_order` (number), `current_version` (semver string, e.g. `"0.7.5"`). Only supplied fields are changed; unmentioned fields are preserved. When `current_version` changes, all phase version records are automatically recalculated. All string inputs are HTML-sanitized. The `200` response returns the full updated node object.

### Example: Upload a feature file

```bash
curl -X PUT https://roadmap-5vvp.onrender.com/api/components/worker/features/mvp-exec.feature \
  --data-binary @components/worker/features/mvp-task-execution.feature
```

### Example: Create an edge

```bash
curl -X POST https://roadmap-5vvp.onrender.com/api/edges \
  -H "Content-Type: application/json" \
  -d '{"source_id":"comp-a","target_id":"comp-b","type":"DEPENDS_ON"}'
```

Required: `source_id`, `target_id` (must reference existing nodes), `type` (valid edge type). Optional: `label` (max 500 chars), `metadata` (JSON object, max 4 KB). Self-referencing edges are rejected. Duplicate edges (same source, target, type) return `409`.

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

### Update a component's progress

```bash
sqlite3 db/architecture.db "UPDATE node_versions SET progress = 40, status = 'in-progress' WHERE node_id = 'supervisor' AND version = 'mvp';"
npm run export
```

### Add a new feature file

1. Create the file: `components/supervisor/features/mvp-health-api.feature`
2. Prefix the filename with the version: `mvp-`, `v1-`, or `v2-`
3. Run: `npm run seed:features && npm run export`

Or use the API:

```bash
curl -X PUT https://roadmap-5vvp.onrender.com/api/components/supervisor/features/mvp-health-api.feature \
  --data-binary @components/supervisor/features/mvp-health-api.feature
```

### Add a new component

Via `seed.sql` (full control):

1. Add the node in `seed.sql` (NODES section)
2. Add containment and relationship edges (EDGES section)
3. Add version content for MVP / v1 / v2 (NODE VERSIONS section)
4. Create `components/<id>/features/` directory
5. Run: `npm run build`

Via the API:

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

The application is deployed on Render as a Docker-based web service. On every push to `master`, Render automatically builds the Docker image (Node 22, SQLite3) and deploys the API server, which also serves the static web view.

**Live URL:** https://roadmap-5vvp.onrender.com

The Render blueprint (`render.yaml`) defines the service configuration. The `Dockerfile` builds the full application including the SQLite database, TypeScript compilation, and static assets. The production server uses `node dist/adapters/api/start.js`.

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
npm run build            # TypeScript compile + rebuild data
npm run build:ts         # TypeScript compile only
npm run build:data       # Rebuild database + seed features + export JSON
npm run build:db         # Rebuild database only (sqlite3 CLI)
npm run seed:features    # Re-seed feature files from components/
npm run export           # Re-export web/data.json from database
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
