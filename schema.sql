-- Living View — SQLite Graph Schema
-- Each architecture component is a node; relationships are edges.
-- Versioned documentation and Gherkin features per component.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Nodes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nodes (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK(type IN ('layer', 'component', 'store', 'external', 'phase', 'app', 'mcp')),
    layer           TEXT,
    color           TEXT,
    icon            TEXT,
    description     TEXT,
    tags            TEXT,                     -- JSON array of tag strings
    sort_order      INTEGER DEFAULT 0,
    current_version TEXT                      -- semver string, NULL = Concept
);

-- ─── Edges ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS edges (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK(type IN (
        'CONTAINS', 'CONTROLS', 'DEPENDS_ON',
        'READS_FROM', 'WRITES_TO',
        'DISPATCHES_TO', 'ESCALATES_TO',
        'PROXIES', 'SANITISES', 'GATES',
        'SEQUENCE'
    )),
    label       TEXT,
    metadata    TEXT,
    UNIQUE(source_id, target_id, type)
);

-- ─── Node Versions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_versions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id     TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version     TEXT NOT NULL,
    content     TEXT,
    progress    INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    status      TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in-progress', 'complete')),
    updated_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(node_id, version)
);

-- ─── Features ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS features (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id     TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version     TEXT NOT NULL,
    filename    TEXT NOT NULL,
    title       TEXT NOT NULL,
    content     TEXT,
    step_count  INTEGER DEFAULT 0,
    updated_at  TEXT DEFAULT (datetime('now'))
);

-- ─── Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
CREATE INDEX IF NOT EXISTS idx_versions_node ON node_versions(node_id);
CREATE INDEX IF NOT EXISTS idx_features_node ON features(node_id);
CREATE INDEX IF NOT EXISTS idx_features_version ON features(node_id, version);
