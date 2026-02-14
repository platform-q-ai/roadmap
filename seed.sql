-- Living View — Seed Data
-- Only active/implemented components

-- ═══════════════════════════════════════════════════════════════════════
-- NODES
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layers ──────────────────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('observability-dashboard', 'Observability Dashboard', 'layer', NULL, 'sky', '📊', 'Runtime Visibility — read-only web UI that observes but never mutates. The single pane of glass for both observation and control.', '["read-only","web ui","live updates"]', 10),
('dual-agents', 'Agent Orchestration', 'layer', NULL, 'orange', '🧠', 'Meta-Agent MCP server orchestrating isolated OpenCode worker sessions. An orchestrator OpenCode session uses the Meta-Agent as an MCP tool server to attach, control, inspect, and prompt any number of worker OpenCode sessions pointed at real git repos.', '["mcp server","opencode","worker orchestration","air-gap"]', 50)
ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, layer=excluded.layer, color=excluded.color, icon=excluded.icon, description=excluded.description, tags=excluded.tags, sort_order=excluded.sort_order;

-- ─── Observability Dashboard Components ──────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('live-dashboard', 'Live Dashboard', 'app', 'observability-dashboard', 'sky', '📊', 'Real-time view of the entire runtime. Read-only — it observes but never mutates. Built as a simple web app (React / plain HTML) that polls the State Store + Supervisor health API. Runs as a separate process managed by the Supervisor. Think: the runtime equivalent of the process tree diagram, but live. Reads from two sources: State Store (goals, tasks, tool logs, escalations, checkpoints) and Supervisor health API (process status, heartbeat data, resource usage). It writes nothing — pure read-only observer. Optional: SSE/WebSocket push from State Store for live updates without polling. Human Gate approval actions can be embedded here, making it the single pane of glass for both observation and control.', '["read-only","web ui","sse/websocket"]', 11)
ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, layer=excluded.layer, color=excluded.color, icon=excluded.icon, description=excluded.description, tags=excluded.tags, sort_order=excluded.sort_order;

-- ─── Agent Orchestration Components ──────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order, current_version) VALUES
('orchestrator-session', 'Orchestrator OpenCode Session', 'app', 'dual-agents', 'green', '🧠', 'The master OpenCode TUI or SDK session that uses the Meta-Agent MCP server as a tool. This is the human-facing session that delegates coding tasks to workers via meta-agent tools. It never writes code directly.', '["pre-existing","opencode","master session","human-facing"]', 49, '1.0.0'),
('meta-agent', 'Meta-Agent MCP Server', 'mcp', 'dual-agents', 'orange', '⇄', 'MCP server (@pqai/meta-agent-mcp v1.0.0) that orchestrates isolated AI worker agents against existing repositories. Implements the air-gap security boundary: the master agent uses this server to delegate coding tasks to worker agents, each an isolated OpenCode session pointed at a real git repo. The master never writes code directly — it sends prompts to workers, monitors progress, reads output files, and instructs when to ship. 14 MCP tools in 4 categories: Worker Management (attach_worker, list_workers, check_worker_status, continue_worker, set_worker_model, stop_worker, remove_worker, health_check), Background Monitoring (watch_worker with TUI prompt injection, cancel_watch), Read-Only Repo Access (read_worker_file, glob_worker, grep_worker with path traversal protection), Message History (get_worker_messages for full untruncated session history). Workers are OpenCode HTTP server instances spawned on sequential ports starting at 5100. Communication via OpenCode REST API. Slash command routing: messages starting with / (e.g. /bdd, /ship) are routed through OpenCode''s command endpoint. Watch system uses non-blocking background polling with TUI prompt injection to port 41965. Persistent worker registry at ~/.meta-agent/registry.json survives MCP server restarts. Runtime deps: @modelcontextprotocol/sdk, glob, zod. Requires opencode CLI installed on system. 97.56% test coverage, 25 BDD scenarios across 7 feature files.', '["pre-existing","v1.0.0","14 mcp tools","air-gap security","opencode integration","tui prompt injection","worker orchestration","mcp server"]', 51, '1.0.0'),
('worker-session-1', 'Worker OpenCode Session 1', 'app', 'dual-agents', 'green', '⚡', 'An isolated OpenCode session pointed at a real git repo. Attached and controlled by the Meta-Agent MCP server. Receives prompts, executes coding tasks, reports status. Has no awareness of other workers or the orchestrator.', '["pre-existing","opencode","worker","isolated","ephemeral"]', 53, '1.0.0'),
('worker-session-2', 'Worker OpenCode Session 2', 'app', 'dual-agents', 'green', '⚡', 'An isolated OpenCode session pointed at a real git repo. Attached and controlled by the Meta-Agent MCP server. Receives prompts, executes coding tasks, reports status. Has no awareness of other workers or the orchestrator.', '["pre-existing","opencode","worker","isolated","ephemeral"]', 54, '1.0.0'),
('worker-session-3', 'Worker OpenCode Session 3', 'app', 'dual-agents', 'green', '⚡', 'An isolated OpenCode session pointed at a real git repo. Attached and controlled by the Meta-Agent MCP server. Receives prompts, executes coding tasks, reports status. Has no awareness of other workers or the orchestrator.', '["pre-existing","opencode","worker","isolated","ephemeral"]', 55, '1.0.0'),
('worker-session-4', 'Worker OpenCode Session 4', 'app', 'dual-agents', 'green', '⚡', 'An isolated OpenCode session pointed at a real git repo. Attached and controlled by the Meta-Agent MCP server. Receives prompts, executes coding tasks, reports status. Has no awareness of other workers or the orchestrator.', '["pre-existing","opencode","worker","isolated","ephemeral"]', 56, '1.0.0')
ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, layer=excluded.layer, color=excluded.color, icon=excluded.icon, description=excluded.description, tags=excluded.tags, sort_order=excluded.sort_order, current_version=excluded.current_version;

-- ─── Standalone Apps ────────────────────────────────────────────────
-- NOTE: roadmap current_version is read from package.json at runtime, not hardcoded here.
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('roadmap', 'Roadmap', 'app', NULL, 'cyan', '🗺', 'Living documentation for the Open Autonomous Runtime. Self-tracking component with progression tree, versioned specs, and Gherkin feature files. Built with Clean Architecture, TypeScript, SQLite, and Cytoscape.js.', '["self-tracking","clean architecture","bdd","progression tree"]', 1)
ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, layer=excluded.layer, color=excluded.color, icon=excluded.icon, description=excluded.description, tags=excluded.tags, sort_order=excluded.sort_order;


-- ═══════════════════════════════════════════════════════════════════════
-- EDGES
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layer CONTAINS ──────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('observability-dashboard', 'live-dashboard', 'CONTAINS', NULL),
('dual-agents', 'orchestrator-session', 'CONTAINS', NULL),
('dual-agents', 'meta-agent', 'CONTAINS', NULL),
('dual-agents', 'worker-session-1', 'CONTAINS', NULL),
('dual-agents', 'worker-session-2', 'CONTAINS', NULL),
('dual-agents', 'worker-session-3', 'CONTAINS', NULL),
('dual-agents', 'worker-session-4', 'CONTAINS', NULL)
ON CONFLICT(source_id, target_id, type) DO UPDATE SET label=excluded.label;

-- ─── Control Flow ────────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('meta-agent', 'worker-session-1', 'CONTROLS', 'attach, stop, detach, set model'),
('meta-agent', 'worker-session-2', 'CONTROLS', 'attach, stop, detach, set model'),
('meta-agent', 'worker-session-3', 'CONTROLS', 'attach, stop, detach, set model'),
('meta-agent', 'worker-session-4', 'CONTROLS', 'attach, stop, detach, set model')
ON CONFLICT(source_id, target_id, type) DO UPDATE SET label=excluded.label;

-- ─── Data Flow ───────────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('meta-agent', 'worker-session-1', 'READS_FROM', 'status, diffs, conversation history'),
('meta-agent', 'worker-session-2', 'READS_FROM', 'status, diffs, conversation history'),
('meta-agent', 'worker-session-3', 'READS_FROM', 'status, diffs, conversation history'),
('meta-agent', 'worker-session-4', 'READS_FROM', 'status, diffs, conversation history'),
('meta-agent', 'worker-session-1', 'WRITES_TO', 'prompt injection via OpenCode API'),
('meta-agent', 'worker-session-2', 'WRITES_TO', 'prompt injection via OpenCode API'),
('meta-agent', 'worker-session-3', 'WRITES_TO', 'prompt injection via OpenCode API'),
('meta-agent', 'worker-session-4', 'WRITES_TO', 'prompt injection via OpenCode API')
ON CONFLICT(source_id, target_id, type) DO UPDATE SET label=excluded.label;

-- ─── Dependency Graph ────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('orchestrator-session', 'meta-agent', 'DEPENDS_ON', 'uses MCP tools'),
('meta-agent', 'worker-session-1', 'DEPENDS_ON', 'controls worker'),
('meta-agent', 'worker-session-2', 'DEPENDS_ON', 'controls worker'),
('meta-agent', 'worker-session-3', 'DEPENDS_ON', 'controls worker'),
('meta-agent', 'worker-session-4', 'DEPENDS_ON', 'controls worker')
ON CONFLICT(source_id, target_id, type) DO UPDATE SET label=excluded.label;


-- ═══════════════════════════════════════════════════════════════════════
-- NODE VERSIONS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layers ──────────────────────────────────────────────────────────
INSERT INTO node_versions (node_id, version, content, progress, status) VALUES
('observability-dashboard', 'overview', 'Read-only web UI. Process view, goal feed, tool timeline, security events, graph explorers. The dashboard is a thin web UI (React / plain HTML) that reads from two sources: the State Store (goals, tasks, tool logs, escalations, checkpoints) and the Supervisor''s health API (process status, heartbeat data, resource usage). It writes nothing — pure read-only observer. Optional: SSE/WebSocket push from State Store for live updates without polling. The Human Gate approval actions can be embedded here too, making it the single pane of glass for both observation and control.', 0, 'planned'),
('dual-agents', 'overview', 'Meta-Agent MCP server orchestrating isolated OpenCode worker sessions. An orchestrator OpenCode session uses the Meta-Agent as an MCP tool server to attach, control, inspect, and prompt any number of worker OpenCode sessions pointed at real git repos. Air-gap security: workers are isolated OpenCode HTTP server instances, the master can only read/message (never write to worker repos).', 100, 'complete')
ON CONFLICT(node_id, version) DO UPDATE SET content=excluded.content, progress=excluded.progress, status=excluded.status;

-- ─── Components ──────────────────────────────────────────────────────
INSERT INTO node_versions (node_id, version, content, progress, status) VALUES
-- Orchestrator Session (pre-existing product)
('orchestrator-session', 'overview', 'The master OpenCode TUI or SDK session that uses the Meta-Agent MCP server as a tool. This is the human-facing session that delegates coding tasks to workers via meta-agent tools. It never writes code directly. Pre-existing product — OpenCode is a fully operational TUI for AI-assisted coding.', 100, 'complete'),
('orchestrator-session', 'mvp', 'Human-facing OpenCode session with Meta-Agent MCP integration. Delegates coding tasks to worker sessions. Monitors progress, reads output files, instructs when to ship. Pre-existing product.', 100, 'complete'),

-- Worker Sessions (pre-existing products)
('worker-session-1', 'overview', 'An isolated OpenCode session pointed at a real git repo. Attached and controlled by the Meta-Agent MCP server. Receives prompts, executes coding tasks, reports status. Pre-existing product — OpenCode workers are fully operational.', 100, 'complete'),
('worker-session-1', 'mvp', 'Isolated OpenCode session for AI-assisted coding. Receives prompts from Meta-Agent, executes tasks, reports status. Pre-existing product.', 100, 'complete'),
('worker-session-2', 'overview', 'An isolated OpenCode session pointed at a real git repo. Attached and controlled by the Meta-Agent MCP server. Receives prompts, executes coding tasks, reports status. Pre-existing product — OpenCode workers are fully operational.', 100, 'complete'),
('worker-session-2', 'mvp', 'Isolated OpenCode session for AI-assisted coding. Receives prompts from Meta-Agent, executes tasks, reports status. Pre-existing product.', 100, 'complete'),
('worker-session-3', 'overview', 'An isolated OpenCode session pointed at a real git repo. Attached and controlled by the Meta-Agent MCP server. Receives prompts, executes coding tasks, reports status. Pre-existing product — OpenCode workers are fully operational.', 100, 'complete'),
('worker-session-3', 'mvp', 'Isolated OpenCode session for AI-assisted coding. Receives prompts from Meta-Agent, executes tasks, reports status. Pre-existing product.', 100, 'complete'),
('worker-session-4', 'overview', 'An isolated OpenCode session pointed at a real git repo. Attached and controlled by the Meta-Agent MCP server. Receives prompts, executes coding tasks, reports status. Pre-existing product — OpenCode workers are fully operational.', 100, 'complete'),
('worker-session-4', 'mvp', 'Isolated OpenCode session for AI-assisted coding. Receives prompts from Meta-Agent, executes tasks, reports status. Pre-existing product.', 100, 'complete'),

-- Meta-Agent
('meta-agent', 'overview', 'MCP server (@pqai/meta-agent-mcp v1.0.0) that orchestrates isolated AI worker agents. Implements the air-gap security boundary between master and worker agents. Architecture: 3 source files (index.ts — MCP tool registration with Zod schemas, tools.ts — core business logic for all 14 tools, registry.ts — persistent worker state at ~/.meta-agent/registry.json). Workers are OpenCode HTTP server instances spawned on sequential ports starting at 5100, communicating via REST API endpoints (/session, /session/:id/prompt_async, /session/:id/message, /session/:id/diff, /session/:id/command). The watch system uses non-blocking background polling with TUI prompt injection to port 41965. Slash commands (e.g. /bdd, /ship) are routed through OpenCode''s command endpoint (fire-and-forget). Security: read-only repo access with path traversal protection, master can only read/message (never write to worker repos). Runtime deps: @modelcontextprotocol/sdk, glob, zod. Requires opencode CLI. 97.56% test coverage (100% functions), 25 BDD scenarios across 7 feature files.', 100, 'complete'),
('meta-agent', 'mvp', 'Worker Management: attach_worker (attach to existing repo, start OpenCode server, create session, send initial prompt), list_workers (list all registered workers with metadata), check_worker_status (busy/idle status, last message preview, diff stats), continue_worker (send follow-up messages, auto-routes slash commands to OpenCode command endpoint), set_worker_model (change AI model for a worker), stop_worker (kill OpenCode server process with multi-level cleanup: tracked process, PID from registry, lsof fallback), remove_worker (stop + remove from registry, does NOT delete repo), health_check (diagnose all workers: healthy/zombie/crashed/never-started, optional auto-fix). Background Monitoring: watch_worker (non-blocking background poller, returns immediately, polls until idle or timeout, injects TUI prompt to master via HTTP to port 41965), cancel_watch (cancel active background watcher by watchId). Read-Only Repo Access: read_worker_file (read files with path traversal protection), glob_worker (find files by glob pattern), grep_worker (search content by regex). Message History: get_worker_messages (full untruncated message history from worker session).', 100, 'complete'),
('meta-agent', 'v1', 'Phase-locked BDD/TDD dispatch pipeline. Gate verification between phases. Escalation response handling. User KG reads for planning context. Code Graph reads for repo-aware decomposition.', 0, 'planned'),
('meta-agent', 'v2', 'Self-evolution: tool discovery + hot-swap via proxy_admin. Config mutation via DSL. Prompt evolution based on observed results. Knowledge curation — write inferred preferences to User KG. Budget and scope guardrails.', 0, 'planned'),

-- Live Dashboard
('live-dashboard', 'overview', 'Real-time view of the entire runtime. Read-only — it observes but never mutates. Built as a simple web app (React / plain HTML) that polls the State Store + Supervisor health API. Runs as a separate process managed by the Supervisor. Think: the runtime equivalent of the process tree diagram, but live. Data sources: State Store → goals, tasks, tool call logs, escalations, checkpoints, fast-path records, injection events. Supervisor Health API → process status, uptime, restart count, memory, current model per instance. No direct process inspection — dashboard never connects to OpenCode or proxies directly. Push vs Poll: SSE from State Store for live updates; poll Supervisor health every 5s. Human Gate embedded: approval buttons for gated tasks + escalation responses in same UI.', 0, 'planned'),
('live-dashboard', 'mvp', 'Single-page web app showing process status (up/down) and current goal. Polls Supervisor health API every 5s. Basic goal queue display from State Store. Static HTML + vanilla JS.', 0, 'planned'),
('live-dashboard', 'v1', 'Full process tree view with live status. Goal & task feed with click-to-inspect. Tool call timeline with filtering. Security events panel. Escalation queue with response actions.', 0, 'planned'),
('live-dashboard', 'v2', 'SSE/WebSocket for real-time push updates. Entity Explorer for User KG. Repo Map for Code Graph. Embedded Human Gate approval UI. Performance metrics and resource graphs.', 0, 'planned'),

-- Roadmap (self-tracking)
('roadmap', 'overview', 'Living documentation for the Open Autonomous Runtime. Self-tracking component with progression tree UI, versioned specs, Gherkin feature files, and BDD/TDD pipeline. Built with Clean Architecture (TypeScript), SQLite graph database, and Cytoscape.js for the progression tree visualization.', 0, 'in-progress'),
('roadmap', 'mvp', 'Clean Architecture TypeScript codebase. SQLite graph database with 4 tables (nodes, edges, node_versions, features). BDD test suite (Cucumber + Vitest). CI merge gate. Static web view with architecture diagram. Progression tree home page with Cytoscape.js. Self-tracking as a component.', 0, 'in-progress'),
('roadmap', 'v1', 'Secure API with key-based auth (scoped permissions, salted hashes, rate limiting, security headers, request logging, structured errors). Neo4j graph storage replacing SQLite (native traversals, multi-hop queries, shortest path, cycle detection, data migration, transaction safety). Enhanced component management (PATCH updates, filtering, search, full edge CRUD, version lifecycle, bulk operations up to 100 items, layer management). Feature-driven progress tracking (step-level maths from Gherkin Given/When/Then counts, passing_steps/total_steps percentage, test result recording, combined semver+step weighting, progress history, dashboard summary APIs, CSV export, automatic recalculation on feature/test changes). Version-scoped feature publishing (explicit version in URL path, Gherkin validation, batch upload, graph traversal endpoints for dependency trees, topological sort, shortest path, neighbourhood queries, next-implementable components, feature search).', 0, 'planned')
ON CONFLICT(node_id, version) DO UPDATE SET content=excluded.content, progress=excluded.progress, status=excluded.status;
