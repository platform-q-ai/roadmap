# Living View — Build Plan

Living documentation for the Open Autonomous Runtime architecture. Each component in the static HTML architecture diagram becomes an interactive, versioned piece of documentation backed by a SQLite graph database.

Built in the open.

---

## What this is

A single-page web view of the Open Autonomous Runtime architecture where:

- Every component (box) in the diagram is a **node** in a SQLite graph database
- Every arrow/relationship is an **edge** with a typed relationship
- Each node has **versioned documentation**: Overview, MVP, v1, v2
- Each version has **Gherkin feature files** that describe the component's behaviour — real specs you can code against
- Each version has a **% complete** indicator, manually updated in the backend
- The web view is read-only, shareable with an audience watching the build happen in real time

---

## Architecture

```
living-view/
├── db/
│   └── architecture.db              # SQLite graph database (source of truth)
├── components/
│   ├── supervisor/
│   │   ├── overview.md
│   │   ├── mvp.md
│   │   ├── v1.md
│   │   ├── v2.md
│   │   └── features/
│   │       ├── mvp-process-management.feature
│   │       ├── mvp-crash-recovery.feature
│   │       ├── v1-heartbeat-monitoring.feature
│   │       └── ...
│   ├── meta-agent/
│   │   ├── overview.md
│   │   ├── mvp.md
│   │   └── features/
│   │       └── ...
│   ├── worker/
│   │   └── ...
│   └── ... (one directory per component)
├── schema.sql                        # Graph database schema
├── scripts/
│   ├── seed.ts                       # Extract components from HTML → DB
│   └── export.ts                     # Export DB → JSON for web view
├── web/
│   ├── index.html                    # The living view (single page)
│   ├── data.json                     # Exported from DB, read by the web view
│   └── assets/
│       └── ...
├── opencode-architecture-v3.2.html   # The original static architecture doc
└── PLAN.md                           # This file
```

---

## SQLite Graph Schema

### Nodes

Every component is a node. Layers (e.g., "Observability Dashboard") are also nodes that contain child components via `CONTAINS` edges.

```sql
CREATE TABLE nodes (
    id          TEXT PRIMARY KEY,         -- e.g., 'supervisor', 'live-dashboard'
    name        TEXT NOT NULL,            -- e.g., 'Supervisor'
    type        TEXT NOT NULL,            -- 'layer' | 'component' | 'store' | 'external'
    layer       TEXT,                     -- which layer this belongs to
    color       TEXT,                     -- theme color from the HTML (purple, cyan, etc.)
    icon        TEXT,                     -- emoji icon
    sort_order  INTEGER DEFAULT 0        -- display ordering
);
```

### Edges

Typed, directed relationships between nodes. Aligned with Clean Architecture principles so the graph itself communicates architectural constraints.

```sql
CREATE TABLE edges (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id   TEXT NOT NULL REFERENCES nodes(id),
    target_id   TEXT NOT NULL REFERENCES nodes(id),
    type        TEXT NOT NULL,            -- relationship type (see below)
    label       TEXT,                     -- optional display label
    metadata    TEXT,                     -- JSON blob for extra context
    UNIQUE(source_id, target_id, type)
);
```

**Edge types:**

| Type | Meaning | Example |
|------|---------|---------|
| `CONTAINS` | Layer/group contains component | observability-dashboard → live-process-view |
| `CONTROLS` | Process/lifecycle control | supervisor → meta-agent |
| `DEPENDS_ON` | Runtime dependency (must exist to function) | worker → mcp-proxy-worker |
| `READS_FROM` | Data flow: read | dashboard → state-store |
| `WRITES_TO` | Data flow: write | checkpointer → state-store |
| `DISPATCHES_TO` | Task/command flow | meta-agent → worker |
| `ESCALATES_TO` | Reverse communication channel | worker → meta-agent |
| `PROXIES` | Indirection/routing layer | mcp-proxy-worker → downstream-tools |
| `SANITISES` | Security boundary (filters traffic) | sanitiser → mcp-proxy-worker |
| `GATES` | Human approval boundary | human-gate → task-router |

### Node Versions

Each component has up to 4 documentation tiers. Each version tracks its own completion percentage.

```sql
CREATE TABLE node_versions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id     TEXT NOT NULL REFERENCES nodes(id),
    version     TEXT NOT NULL,            -- 'overview' | 'mvp' | 'v1' | 'v2'
    content     TEXT,                     -- markdown content (or path to .md file)
    progress    INTEGER DEFAULT 0,        -- 0-100, manually adjusted
    status      TEXT DEFAULT 'planned',   -- 'planned' | 'in-progress' | 'complete'
    updated_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(node_id, version)
);
```

### Features

Gherkin feature files linked to a specific node and version.

```sql
CREATE TABLE features (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id     TEXT NOT NULL REFERENCES nodes(id),
    version     TEXT NOT NULL,            -- which version this feature belongs to
    filename    TEXT NOT NULL,            -- e.g., 'mvp-process-management.feature'
    title       TEXT NOT NULL,            -- feature title
    content     TEXT,                     -- full Gherkin content
    updated_at  TEXT DEFAULT (datetime('now'))
);
```

---

## Components to Extract

These are the nodes parsed from the HTML architecture document. Grouped by layer.

### Observability Dashboard (layer)
- Live Dashboard (Web UI)
- Live Process View
- Goal & Task Feed
- Tool Call Timeline
- Security Events
- Escalation Queue
- Entity Explorer
- Repo Map
- Human Gate (dashboard)

### Supervisor (layer)
- Supervisor (process manager)
- Dual Heartbeat
- Human Gate
- Fast Path Router

### Task Router (layer)
- Fast Path
- Full Path
- Gated Path

### User Knowledge Graph (layer)
- Entity-Relationship Store
- Entity Types
- Relationship Types

### RPG Code Graph (layer)
- Repository Planning Graph
- Node Types
- Edge Types

### Meta-Agent (layer)
- Planner Instance
- goal_queue tool
- state_reader tool
- worker_control tool
- proxy_admin tool
- config_mutator tool
- tool_registry tool
- user_kg_read tool
- user_kg_write tool
- code_graph_read tool
- code_graph_write tool

### Worker (layer)
- Executor Instance
- request_clarification tool
- check_escalation_response tool
- user_kg_read (worker) tool
- code_graph_read (worker) tool
- Dynamic tool manifest (search, email, db, fs, code_exec, custom)

### Escalation Flow (layer)
- Escalation sequence

### Shared State Store (layer)
- State Store (SQLite WAL / Postgres)
- Checkpointer
- Context Rebuilder

### MCP Proxies (layer)
- MCP Proxy — Meta-Agent
- MCP Proxy — Worker

### Security Sandbox (layer)
- 3-Stage Sanitiser
- Alert pipeline

### Downstream Tools (layer)
- Search, Email, DB, FS, Code, Custom (external servers)

### BDD/TDD Pipeline (layer)
- Feature phase
- Step Tests phase
- Unit Tests phase
- Red phase
- Green phase
- Refactor phase
- Architecture Review phase
- Security Review phase

---

## Web View Design

### Layout
Same dark aesthetic as the existing HTML. The architecture is displayed as a layered stack (same visual structure), but each component box is interactive.

### Component interaction
- Default state: shows **Overview** — a short summary, same density as the current HTML
- Click/toggle strip on each box: `Overview | MVP | v1 | v2`
- Active version shows the markdown content for that tier
- Progress badge on each version: `MVP 40%` with a thin progress bar
- Feature files listed under the detail view, expandable

### Progress indicators
- Each version badge is color-coded: grey (planned), blue (in-progress), green (complete)
- Overall component progress = weighted average of version completions
- Layer-level progress = average of child component progress

### Data flow
```
SQLite DB  →  export script  →  data.json  →  web view reads JSON
```

The web view is fully static (no server). The export script runs locally after any DB update and produces a `data.json` that the HTML page consumes. This means it can be hosted on GitHub Pages, Netlify, or any static host.

### Non-goals (for now)
- No live editing in the web view — it's read-only
- No real-time sync — manual export after DB changes
- No authentication — public page

---

## Build Order

### Phase 1: Foundation
1. Write SQLite schema (`schema.sql`)
2. Extract all components from HTML into seed data (`seed.sql` or `seed.ts`)
3. Create the DB with schema + seed data
4. Generate the component directory structure with initial `.md` files

### Phase 2: Content
5. Write Overview content for each component (extracted from existing HTML descriptions)
6. Write MVP detail for each component (what's the minimum viable version?)
7. Write initial Gherkin feature files for MVP versions

### Phase 3: Web View
8. Build the single-page web view with version toggles and progress indicators
9. Write the export script (DB → JSON)
10. Style to match the existing dark theme

### Phase 4: Polish
11. Add v1 and v2 content as the project evolves
12. Add feature files for v1 and v2 as they're planned
13. Host publicly

---

## Versioning Philosophy

Each component evolves independently. The versions mean:

- **Overview**: What is this component and why does it exist? One paragraph. Never changes much.
- **MVP**: The absolute minimum to prove this component works. Cut every corner that can be cut. What do you build in a weekend?
- **v1**: First real version. Handles the happy path well. Has basic error handling. You'd demo this.
- **v2**: Production-grade. Edge cases handled. Performance considered. You'd ship this.

Feature files are **derived from** the detail level of each version. MVP features are minimal. v1 features cover the happy path. v2 features cover edge cases and failure modes.

Progress (%) is manually set in the DB. It reflects actual build progress, not documentation completeness.
