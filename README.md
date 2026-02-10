# Living View

Living documentation for the **Open Autonomous Runtime** architecture. Each component in the system is a node in a SQLite graph database with versioned specs (MVP / v1 / v2), Gherkin feature files, and progress tracking. The web view renders the full architecture as an interactive diagram where every component can be expanded to explore its documentation and build status.

Built in the open.

## Quick Start

```bash
# Rebuild the database from schema + seed
rm -f db/architecture.db
sqlite3 db/architecture.db < schema.sql
sqlite3 db/architecture.db < seed.sql
node scripts/seed-features.js

# Export to JSON for the web view
node scripts/export.js

# Serve locally
python3 -m http.server 8080 --directory web
# Open http://localhost:8080
```

## Repository Structure

```
living-view/
├── schema.sql                  # SQLite graph schema (nodes, edges, versions, features)
├── seed.sql                    # All component data extracted from architecture HTML
├── db/
│   └── architecture.db         # Built SQLite database (generated — do not edit directly)
├── components/
│   ├── supervisor/
│   │   └── features/
│   │       └── mvp-process-management.feature
│   ├── meta-agent/
│   │   └── features/
│   │       └── mvp-planning-loop.feature
│   ├── worker/
│   │   └── features/
│   │       └── mvp-task-execution.feature
│   └── ... (50+ component directories)
├── scripts/
│   ├── export.js               # DB → web/data.json
│   └── seed-features.js        # Scan .feature files into DB
├── web/
│   ├── index.html              # Interactive web view (single page, static)
│   └── data.json               # Exported data (generated — do not edit directly)
├── opencode-architecture-v3.2.html  # Original static architecture document
└── PLAN.md                     # Detailed build plan
```

## How It Works

### Data Model

Everything lives in four SQLite tables:

- **nodes** — 66 components (layers, components, stores, external tools, pipeline phases). Each has an id, name, type, color, icon, description, and JSON tags array.
- **edges** — 106 typed relationships (CONTAINS, CONTROLS, READS_FROM, WRITES_TO, DISPATCHES_TO, ESCALATES_TO, PROXIES, SANITISES, GATES, SEQUENCE).
- **node_versions** — 103 versioned specs. Each component can have MVP, v1, and v2 documentation with a progress percentage (0-100) and status (planned / in-progress / complete).
- **features** — 11 Gherkin feature files linked to components and versions.

### Data Flow

```
seed.sql + schema.sql  →  sqlite3  →  architecture.db
                                            ↓
components/**/features/*.feature  →  seed-features.js  →  architecture.db
                                                              ↓
                                                        export.js  →  data.json  →  web view
```

The web view is fully static. It reads `data.json` on load. No server required — host on GitHub Pages, Netlify, or any static host.

### Web View

The interactive page renders the architecture as a layered stack matching the original HTML document's dark theme. Each component box:

- Shows its description and tags in collapsed state
- Expands on click to show a version toggle strip (MVP / v1 / v2)
- Displays the selected version's content with progress badge
- Lists associated Gherkin feature files (expandable)

## Common Tasks

### Update a component's progress

```bash
sqlite3 db/architecture.db "UPDATE node_versions SET progress = 40, status = 'in-progress' WHERE node_id = 'supervisor' AND version = 'mvp';"
node scripts/export.js
```

### Add a new feature file

1. Create the file: `components/supervisor/features/mvp-health-api.feature`
2. Prefix the filename with the version: `mvp-`, `v1-`, or `v2-`
3. Run: `node scripts/seed-features.js && node scripts/export.js`

### Add a new component

1. Add the node to `seed.sql` in the NODES section
2. Add edges in the EDGES section
3. Add version content in the NODE VERSIONS section
4. Create `components/<id>/features/` directory
5. Rebuild: `rm -f db/architecture.db && sqlite3 db/architecture.db < schema.sql && sqlite3 db/architecture.db < seed.sql && node scripts/seed-features.js && node scripts/export.js`

### Full rebuild

```bash
rm -f db/architecture.db
sqlite3 db/architecture.db < schema.sql
sqlite3 db/architecture.db < seed.sql
node scripts/seed-features.js
node scripts/export.js
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

## Requirements

- `sqlite3` CLI
- Node.js (for export scripts)
- Any HTTP server for local viewing (Python, Node, etc.)
