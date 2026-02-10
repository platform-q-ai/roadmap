# AGENTS.md — Instructions for LLM Maintainers

This file tells you how to work with this repository. Read it before making changes.

## What This Repo Is

Living documentation for the Open Autonomous Runtime. The source of truth is a SQLite database (`db/architecture.db`) built from `schema.sql` + `seed.sql`. The web view (`web/index.html`) is a read-only static page that reads from `web/data.json` (exported from the DB).

**Do not edit `db/architecture.db` or `web/data.json` directly.** They are generated files. Edit `seed.sql` for data changes, `schema.sql` for schema changes, `web/index.html` for UI changes.

## Architecture at a Glance

```
seed.sql  ──→  architecture.db  ──→  data.json  ──→  web view
schema.sql ─┘                    ↑
components/**/*.feature  ────────┘ (via seed-features.js)
```

## File Roles

| File | Role | Edit? |
|------|------|-------|
| `schema.sql` | Database schema (4 tables: nodes, edges, node_versions, features) | Yes — for structural changes |
| `seed.sql` | All component data, edges, and version content | Yes — primary data file |
| `db/architecture.db` | Built SQLite database | No — generated |
| `scripts/export.js` | Exports DB to `web/data.json` | Yes — if data shape changes |
| `scripts/seed-features.js` | Scans `components/*/features/*.feature` into DB | Yes — if feature file conventions change |
| `web/index.html` | Interactive web view (HTML + CSS + JS, single file) | Yes — for UI changes |
| `web/data.json` | JSON data consumed by web view | No — generated |
| `components/*/features/*.feature` | Gherkin feature files per component | Yes — add/edit feature specs |
| `opencode-architecture-v3.2.html` | Original static architecture doc (reference only) | No — historical reference |
| `PLAN.md` | Build plan and design decisions | Rarely — update if architecture changes |

## Rebuild Commands

Always run after changing `seed.sql`, `schema.sql`, or feature files:

```bash
rm -f db/architecture.db
sqlite3 db/architecture.db < schema.sql
sqlite3 db/architecture.db < seed.sql
node scripts/seed-features.js
node scripts/export.js
```

Or in one line:

```bash
rm -f db/architecture.db && sqlite3 db/architecture.db < schema.sql && sqlite3 db/architecture.db < seed.sql && node scripts/seed-features.js && node scripts/export.js
```

## How to Add a New Component

1. **Add the node** in `seed.sql` under the appropriate section:

```sql
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('my-component', 'My Component', 'component', 'parent-layer-id', 'cyan', '🔧', 'Full description of what this does.', '["tag1","tag2"]', 99);
```

- `id`: kebab-case, unique, used as directory name and foreign key
- `type`: one of `layer`, `component`, `store`, `external`, `phase`
- `layer`: id of the parent layer (or NULL for layers themselves)
- `color`: one of `sky`, `purple`, `lime`, `gold`, `orange`, `cyan`, `blue`, `red`, `amber`, `teal`, `green`, `emerald`, `rose`, `pink`, `indigo`
- `tags`: JSON array of short tag strings
- `sort_order`: controls display ordering within a layer

2. **Add containment edge** (if it belongs to a layer):

```sql
INSERT INTO edges (source_id, target_id, type, label) VALUES
('parent-layer-id', 'my-component', 'CONTAINS', NULL);
```

3. **Add relationship edges** to other components:

```sql
INSERT INTO edges (source_id, target_id, type, label) VALUES
('my-component', 'state-store', 'READS_FROM', 'task data');
```

Edge types: `CONTAINS`, `CONTROLS`, `DEPENDS_ON`, `READS_FROM`, `WRITES_TO`, `DISPATCHES_TO`, `ESCALATES_TO`, `PROXIES`, `SANITISES`, `GATES`, `SEQUENCE`.

4. **Add version content** (MVP, v1, v2):

```sql
INSERT INTO node_versions (node_id, version, content, progress, status) VALUES
('my-component', 'mvp', 'What the MVP version does. Minimum viable scope.', 0, 'planned'),
('my-component', 'v1', 'First real version. Happy path handled.', 0, 'planned'),
('my-component', 'v2', 'Production-grade. Edge cases, performance.', 0, 'planned');
```

- `version`: one of `overview`, `mvp`, `v1`, `v2` (overview is shown as the box description; mvp/v1/v2 appear as tabs)
- `progress`: 0-100 integer, manually updated
- `status`: `planned`, `in-progress`, or `complete`

5. **Create the component directory and feature files**:

```bash
mkdir -p components/my-component/features
```

Write Gherkin feature files prefixed with the version: `mvp-*.feature`, `v1-*.feature`, `v2-*.feature`.

6. **Rebuild** the database and export.

## How to Add a Feature File

Feature files live in `components/<node-id>/features/`. The directory name must match the node id in the database.

Filename convention: `<version>-<descriptive-name>.feature`

```
components/supervisor/features/mvp-process-management.feature
components/supervisor/features/v1-crash-recovery.feature
```

The `seed-features.js` script determines the version from the filename prefix:
- `mvp-*` → version `mvp`
- `v1-*` → version `v1`
- `v2-*` → version `v2`
- anything else → defaults to `mvp`

Feature files should follow standard Gherkin:

```gherkin
Feature: Component Name (Version)
  Brief description of the feature scope.

  Background:
    Given preconditions

  Scenario: What is being tested
    Given some state
    When an action happens
    Then expected outcome
```

## How to Update Progress

Progress is tracked per component per version in the `node_versions` table:

```bash
# Mark supervisor MVP as 40% in-progress
sqlite3 db/architecture.db "UPDATE node_versions SET progress = 40, status = 'in-progress' WHERE node_id = 'supervisor' AND version = 'mvp';"

# Mark it complete
sqlite3 db/architecture.db "UPDATE node_versions SET progress = 100, status = 'complete' WHERE node_id = 'supervisor' AND version = 'mvp';"

# Re-export
node scripts/export.js
```

You can also batch-update in `seed.sql` by changing the progress/status values and doing a full rebuild.

## How to Modify the Web View

The web view is a single HTML file at `web/index.html`. It uses:

- **Same theme as the original architecture HTML**: dark background (#07080c), JetBrains Mono + DM Sans fonts, color-coded borders per component type
- **No build step, no dependencies**: vanilla HTML + CSS + JS
- **Data from `data.json`**: fetched on page load, renders the full architecture

Key rendering functions in the JS:
- `renderLayer(layer)` — renders a layer container with its children
- `renderBox(node)` — renders a single component box (collapsed or expanded)
- `renderVersionStrip(node)` — the MVP/v1/v2 toggle buttons
- `renderVersionContent(node)` — the expanded content + feature files
- `renderTags(node)` — inline tag badges
- `renderDualAgents(layer)` — special dual-panel layout for Meta-Agent + Worker
- `renderPipeline(layer)` — horizontal phase pipeline for BDD/TDD
- `renderSplit(layer)` — side-by-side layout for Knowledge Graphs and MCP Proxies

Colors must use the CSS variables defined in `:root`. The color name on a node (e.g., `cyan`, `purple`) maps to CSS classes like `.b-cyan`, `.l-purple`.

## Conventions

- **Node IDs are kebab-case** and match their `components/` directory name
- **Descriptions should be comprehensive** — include all technical detail from the architecture doc (model names, port numbers, specific commands, payload formats)
- **Tags are short labels** — used for at-a-glance context (e.g., `tier-0`, `new`, `read-only`, `fail-closed`)
- **The `new` tag** gets special styling (lime green) in the web view
- **Version content is plain text** — no markdown rendering in the web view currently
- **Feature files are real Gherkin** — meant to be picked up and coded against, not just documentation
- **The overview version** is used for the box description text; MVP/v1/v2 appear as expandable tabs

## Database Schema Quick Reference

```sql
-- Nodes: the components
nodes(id TEXT PK, name, type, layer, color, icon, description, tags TEXT/JSON, sort_order)

-- Edges: relationships between components
edges(id INT PK, source_id FK, target_id FK, type, label, metadata TEXT/JSON)

-- Versions: MVP/v1/v2 documentation per component
node_versions(id INT PK, node_id FK, version, content, progress INT 0-100, status, updated_at)

-- Features: Gherkin files linked to components
features(id INT PK, node_id FK, version, filename, title, content, updated_at)
```

## Querying the Graph

Useful queries for understanding the architecture:

```bash
# List all layers and their child counts
sqlite3 db/architecture.db "SELECT n.name, count(e.id) as children FROM nodes n LEFT JOIN edges e ON n.id = e.source_id AND e.type = 'CONTAINS' WHERE n.type = 'layer' GROUP BY n.id ORDER BY n.sort_order;"

# What does a component read from?
sqlite3 db/architecture.db "SELECT target_id, label FROM edges WHERE source_id = 'meta-agent' AND type = 'READS_FROM';"

# What controls the worker?
sqlite3 db/architecture.db "SELECT source_id, label FROM edges WHERE target_id = 'worker' AND type IN ('CONTROLS', 'DISPATCHES_TO');"

# Components with MVP in-progress
sqlite3 db/architecture.db "SELECT n.name, nv.progress FROM nodes n JOIN node_versions nv ON n.id = nv.node_id WHERE nv.version = 'mvp' AND nv.status = 'in-progress';"

# BDD/TDD pipeline order
sqlite3 db/architecture.db "SELECT source_id, '→', target_id FROM edges WHERE type = 'SEQUENCE' ORDER BY id;"
```
