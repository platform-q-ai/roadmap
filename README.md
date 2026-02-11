# Roadmap

Living documentation for the **Open Autonomous Runtime** architecture. Every component in the system is a node in a SQLite graph database with versioned specs (MVP / v1 / v2), Gherkin feature files, and progress tracking. A static web view renders the full architecture as an interactive diagram where every box can be expanded to explore documentation, build status, and BDD specs.

**Live:** [platform-q-ai.github.io/roadmap](https://platform-q-ai.github.io/roadmap/)

Built in the open.

## Architecture Overview

The runtime is an autonomous AI agent system built around two LLM-powered instances (a Meta-Agent planner and a Worker executor) orchestrated by a Supervisor process. The architecture spans 11 layers and 55+ components:

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

Prerequisites: `sqlite3` CLI and Node.js.

```bash
git clone https://github.com/platform-q-ai/roadmap.git
cd roadmap
npm install
npm run build
```

This rebuilds the database, seeds feature files, and exports `web/data.json`. Then serve locally:

```bash
npm run serve
# Open http://localhost:8080
```

## Repository Structure

The codebase follows Clean Architecture. Dependencies point inward: adapters -> use-cases -> domain.

```
roadmap/
├── schema.sql                  # SQLite graph schema
├── seed.sql                    # All component data, edges, and version content
├── db/
│   └── architecture.db         # Built SQLite database (generated)
├── src/
│   ├── domain/                 # Entities + repository interfaces (zero deps)
│   │   ├── entities/           # Node, Edge, Version, Feature
│   │   └── repositories/      # Abstract interfaces (contracts only)
│   ├── use-cases/              # Business logic (depends only on domain)
│   │   ├── get-architecture.js
│   │   ├── export-architecture.js
│   │   ├── seed-features.js
│   │   └── update-progress.js
│   ├── infrastructure/         # Concrete implementations
│   │   └── sqlite/             # better-sqlite3 repository implementations
│   └── adapters/               # Entry points
│       └── cli/                # CLI commands (export, seed-features)
├── components/
│   ├── supervisor/features/
│   ├── meta-agent/features/
│   ├── worker/features/
│   └── ... (50+ component directories)
├── web/
│   ├── index.html              # Interactive web view (single file, no dependencies)
│   └── data.json               # Exported data (generated)
├── specs/                      # Detailed component specifications
└── AGENTS.md                   # Instructions for LLM maintainers
```

## How It Works

### Data Model

Everything lives in four SQLite tables:

- **nodes** -- 66 components (layers, components, stores, external tools, pipeline phases). Each has an id, name, type, color, icon, description, and JSON tags array.
- **edges** -- 106 typed relationships (CONTAINS, CONTROLS, READS_FROM, WRITES_TO, DISPATCHES_TO, ESCALATES_TO, PROXIES, SANITISES, GATES, SEQUENCE).
- **node_versions** -- 103 versioned specs. Each component has MVP, v1, and v2 documentation with progress (0-100%) and status (planned / in-progress / complete).
- **features** -- Gherkin feature files linked to components and versions.

### Data Flow

```
seed.sql + schema.sql  ->  sqlite3  ->  architecture.db
                                              |
components/**/features/*.feature  ->  seed-features  ->  architecture.db
                                                               |
                                                         export  ->  data.json  ->  web view
```

### Clean Architecture

New delivery mechanisms (API server, MCP server, VS Code extension) are added as adapters in `src/adapters/` that reuse existing use cases. The domain and use-case layers never change to support a new delivery mechanism.

```
Adapters (CLI, API, MCP)  ->  Use Cases  ->  Domain (entities + interfaces)
                                   |
                          Infrastructure (SQLite)
```

### Web View

The interactive page renders the architecture as a layered diagram with a dark theme. Each component box:

- Shows its description, progress badge, and tags when collapsed
- Expands on click to reveal a version toggle strip (MVP / v1 / v2)
- Displays the selected version's content with a progress bar
- Lists associated Gherkin feature files (expandable)

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

### Add a new component

1. Add the node in `seed.sql` (NODES section)
2. Add containment and relationship edges (EDGES section)
3. Add version content for MVP / v1 / v2 (NODE VERSIONS section)
4. Create `components/<id>/features/` directory
5. Run: `npm run build`

See [AGENTS.md](AGENTS.md) for detailed instructions and schema reference.

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

## Deployment

The site deploys to GitHub Pages automatically on push to `master` via `.github/workflows/pages.yml`. It serves the `web/` directory as a static site.

To deploy manually or to another static host, just serve the `web/` directory -- it contains only `index.html` and `data.json` with no build step or dependencies.

## Tech Stack

- **SQLite** + **better-sqlite3** -- graph database backend
- **Node.js** (ESM) -- clean architecture application layer
- **Vanilla HTML/CSS/JS** -- single-file web view, zero frameworks
- **Gherkin** -- BDD feature specs per component
- **GitHub Actions** -- CI/CD to GitHub Pages
