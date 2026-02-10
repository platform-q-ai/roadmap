-- Living View — Seed Data
-- Extracted from opencode-architecture-v3.2.html

-- ═══════════════════════════════════════════════════════════════════════
-- NODES
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layers ──────────────────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('observability-dashboard', 'Observability Dashboard', 'layer', NULL, 'sky', '📊', 'Runtime Visibility — read-only web UI that observes but never mutates.', 10),
('supervisor-layer', 'Supervisor', 'layer', NULL, 'purple', '👁', 'The Only Immortal Process — process management, signal handling, recovery.', 20),
('task-router-layer', 'Task Router', 'layer', NULL, 'lime', '⚡', 'Fast Path Decision Point — routes tasks by complexity.', 30),
('knowledge-graphs', 'Knowledge Graphs', 'layer', NULL, 'gold', '🧠', 'Dual graph stores: User Knowledge Graph + RPG Code Graph.', 40),
('dual-agents', 'Dual OpenCode Instances', 'layer', NULL, 'orange', '🧠', 'Meta-Agent (Planner) + Worker (Executor) — two stock OpenCode instances.', 50),
('escalation-flow', 'Escalation Flow', 'layer', NULL, 'teal', '🙋', 'Worker ↔ Meta-Agent communication via shared state.', 60),
('shared-state', 'Shared State Store', 'layer', NULL, 'blue', '💾', 'The Bridge — SQLite WAL / Postgres shared by both instances.', 70),
('mcp-proxies', 'MCP Proxies', 'layer', NULL, 'orange', '⇄', 'Tool proxy layer for both agent instances.', 80),
('security-sandbox', 'Security Sandbox', 'layer', NULL, 'red', '🛡', 'Sanitiser — Worker proxy only. 3-stage pipeline.', 90),
('downstream-tools', 'Downstream MCP Tool Servers', 'layer', NULL, 'amber', '🔧', 'External tool servers — hot-swappable.', 100),
('bdd-tdd-pipeline', 'BDD/TDD Phase Pipeline', 'layer', NULL, 'teal', '🔄', 'Strict phase pipeline enforced by Meta-Agent, executed by Worker.', 110);

-- ─── Observability Dashboard Components ──────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('live-dashboard', 'Live Dashboard', 'component', 'observability-dashboard', 'sky', '📊', 'Real-time view of the entire runtime. Read-only — it observes but never mutates. Built as a simple web app that polls the State Store + Supervisor health API.', 11),
('live-process-view', 'Live Process View', 'component', 'observability-dashboard', 'sky', '🔴', 'Process tree with real-time status: running, recovering, crashed, paused. Uptime, restart count, current model, memory usage per instance.', 12),
('goal-task-feed', 'Goal & Task Feed', 'component', 'observability-dashboard', 'sky', '📋', 'Live stream of the Goal Queue. Current goal, decomposed sub-tasks, completion status. Clickable to inspect full task payloads.', 13),
('tool-call-timeline', 'Tool Call Timeline', 'component', 'observability-dashboard', 'sky', '🔧', 'Chronological feed of every tool call. Shows tool name, args, response status, latency, sanitiser verdict. Filterable by instance, tool, and status.', 14),
('security-events', 'Security Events', 'component', 'observability-dashboard', 'sky', '🛡', 'Sanitiser verdicts, blocked injections with raw payload preview, injection frequency per tool, auto-disable events.', 15),
('escalation-queue', 'Escalation Queue', 'component', 'observability-dashboard', 'sky', '⏸', 'Worker escalation requests waiting for Meta-Agent or human review. Shows question, context snapshot, and available actions.', 16),
('entity-explorer', 'Entity Explorer', 'component', 'observability-dashboard', 'sky', '👤', 'Browse the User Knowledge Graph. See people, projects, preferences, and their relationships.', 17),
('repo-map', 'Repo Map', 'component', 'observability-dashboard', 'sky', '🗺', 'Visualise the Code Graph. Module hierarchy, file deps, data flows.', 18),
('human-gate-dashboard', 'Human Gate (Dashboard)', 'component', 'observability-dashboard', 'sky', '⛳', 'Approval queue + escalation responses. Gate actions embeddable in dashboard UI.', 19);

-- ─── Supervisor Components ───────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('supervisor', 'Supervisor', 'component', 'supervisor-layer', 'purple', '👁', 'Manages all child processes. Heartbeat + crash recovery with tiered priority. No LLM, no planning — just process management, signal handling, and the recovery state machine. Exposes a health API (HTTP) for the dashboard.', 21),
('dual-heartbeat', 'Dual Heartbeat', 'component', 'supervisor-layer', 'purple', '💓', 'Monitors both OpenCode instances via waitpid() + liveness probes. Instant crash detection. Periodic liveness probe for hang detection. Exponential backoff, max 5 retries.', 22),
('human-gate', 'Human Gate', 'component', 'supervisor-layer', 'pink', '⛳', 'Three modes: full-auto, approve-goals, approve-all. Plus write fence for dangerous ops. Gate mode is a runtime flag — switch without restarting.', 23),
('fast-path-router', 'Fast Path Router', 'component', 'supervisor-layer', 'lime', '⚡', 'Rule engine (no LLM). Classifies tasks as fast, full, or gated. Can query User KG for context.', 24);

-- ─── Task Router Components ──────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('fast-path', 'Fast Path', 'component', 'task-router-layer', 'lime', '⚡', 'Rule engine says: single-step, unambiguous, existing tools suffice. Task goes directly to Worker. Meta-Agent notified post-completion.', 31),
('full-path', 'Full Path', 'component', 'task-router-layer', 'orange', '🧠', 'Classifier says: multi-step, ambiguous, or needs tool changes. Task goes to Meta-Agent for decomposition.', 32),
('gated-path', 'Gated Path', 'component', 'task-router-layer', 'purple', '⛳', 'Classifier or Human Gate flags: destructive, high-cost, or security-sensitive. Task pauses for human approval.', 33);

-- ─── Knowledge Graph Components ──────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('user-knowledge-graph', 'User Knowledge Graph', 'store', 'knowledge-graphs', 'gold', '👤', 'A persistent graph of the user''s world. Nodes are domain entities — people, projects, clients, teams, products, preferences, business rules, conventions, deadlines.', 41),
('rpg-code-graph', 'RPG Code Graph', 'store', 'knowledge-graphs', 'emerald', '🗺', 'An RPG-style structural graph of the current codebase. Encodes file hierarchy, module boundaries, inter-module data flows, function signatures, class inheritance, and import dependencies.', 42);

-- ─── Dual Agent Components ───────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('meta-agent', 'Meta-Agent (Planner)', 'component', 'dual-agents', 'orange', '🧠', 'Stock OpenCode, planning system prompt, cheap/fast model. Plans, evaluates, dispatches. Never touches codebase or external APIs directly. Tier-0: recovered first.', 51),
('worker', 'Worker (Executor)', 'component', 'dual-agents', 'cyan', '⚡', 'Stock OpenCode, execution system prompt, strong model. Executes one phase at a time. Ephemeral and replaceable. Tier-1: recovered second.', 52),
('goal-queue', 'goal_queue', 'component', 'dual-agents', 'orange', '📋', 'push, pop, peek, reprioritise — manages the persistent goal queue.', 53),
('state-reader', 'state_reader', 'component', 'dual-agents', 'orange', '📖', 'get_checkpoint, get_task_log, get_escalations — reads Worker''s progress.', 54),
('worker-control', 'worker_control', 'component', 'dual-agents', 'orange', '🔧', 'dispatch, abort, respond_escalation — sends phase-locked work to Worker.', 55),
('proxy-admin', 'proxy_admin', 'component', 'dual-agents', 'orange', '📡', 'register, deregister, list — mutates Worker''s tool manifest.', 56),
('config-mutator', 'config_mutator', 'component', 'dual-agents', 'orange', '⚙', 'update_prompt, update_model, update_agents — evolves Worker''s config via DSL.', 57),
('tool-registry', 'tool_registry', 'component', 'dual-agents', 'orange', '🔍', 'search, inspect, install — discovers new MCP servers from catalogue.', 58),
('user-kg-read-meta', 'user_kg_read (Meta)', 'component', 'dual-agents', 'gold', '👤', 'query, traverse, search — Meta-Agent reads User KG.', 59),
('user-kg-write-meta', 'user_kg_write (Meta)', 'component', 'dual-agents', 'gold', '✏', 'add_entity, add_edge, annotate — Meta-Agent writes to User KG.', 60),
('code-graph-read-meta', 'code_graph_read (Meta)', 'component', 'dual-agents', 'emerald', '🗺', 'expand, path, topo_order — Meta-Agent reads Code Graph.', 61),
('code-graph-write-meta', 'code_graph_write (Meta)', 'component', 'dual-agents', 'emerald', '✏', 'annotate_module, set_data_flow — Meta-Agent writes to Code Graph.', 62),
('request-clarification', 'request_clarification', 'component', 'dual-agents', 'teal', '🙋', 'Writes question + context snapshot to State Store. Sets task status to paused:awaiting_guidance.', 63),
('check-escalation-response', 'check_escalation_response', 'component', 'dual-agents', 'teal', '📨', 'Polls State Store for Meta-Agent''s response. Returns guidance or still_pending.', 64),
('user-kg-read-worker', 'user_kg_read (Worker)', 'component', 'dual-agents', 'gold', '👤', 'Read-only. No writes (injection safety).', 65),
('code-graph-read-worker', 'code_graph_read (Worker)', 'component', 'dual-agents', 'emerald', '🗺', 'Read-only. Checkpointer writes on its behalf.', 66);

-- ─── Shared State Components ─────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('state-store', 'State Store', 'store', 'shared-state', 'blue', '💾', 'Append-only log that both instances read/write. Goals, tasks, tool logs, checkpoints, escalations. The bridge between both OpenCode instances — they share a database, not a connection.', 71),
('checkpointer', 'Checkpointer', 'component', 'shared-state', 'blue', '📸', 'Taps Worker''s Proxy. Writes after every tool response: task ID, tool name, args, result hash, timestamp. Async — doesn''t block the agent. Also triggers Code Graph updates on file edits.', 72),
('context-rebuilder', 'Context Rebuilder', 'component', 'shared-state', 'blue', '📝', 'On crash recovery: generates resume prompt from compressed checkpoint + relevant graph context. Lossy by design — like a save game, not a VM snapshot.', 73);

-- ─── MCP Proxy Components ────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('mcp-proxy-meta', 'MCP Proxy — Meta-Agent', 'component', 'mcp-proxies', 'orange', '⇄', 'Hosts 10 planning tools (6 planning + 4 graph). Static manifest. No external API calls, no injection risk. No sanitiser needed.', 81),
('mcp-proxy-worker', 'MCP Proxy — Worker', 'component', 'mcp-proxies', 'cyan', '⇄', 'Hosts all external-facing tools + escalation + graph reads. Dynamic manifest — hot-swappable. All responses pass through Sanitiser. Circuit breaker on downstream health.', 82);

-- ─── Security Components ─────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('sanitiser', '3-Stage Sanitiser', 'component', 'security-sandbox', 'red', '🛡', 'Sits between Worker''s Proxy and downstream servers. ① Heuristic regex → ② Structural strip → ③ Optional LLM classifier. Fail-closed. Scans inbound + outbound.', 91),
('alert-pipeline', 'Alert Pipeline', 'component', 'security-sandbox', 'red', '📋', 'Blocked injections logged to State Store. Meta-Agent can auto-disable compromised tools. Dashboard shows real-time security events.', 92);

-- ─── Downstream Tools ────────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('tool-search', 'Search', 'external', 'downstream-tools', 'amber', '🔍', 'External search MCP server.', 101),
('tool-email', 'Email', 'external', 'downstream-tools', 'amber', '✉', 'External email MCP server.', 102),
('tool-database', 'Database', 'external', 'downstream-tools', 'amber', '🗄', 'External database MCP server.', 103),
('tool-filesystem', 'Filesystem', 'external', 'downstream-tools', 'amber', '📂', 'External filesystem MCP server.', 104),
('tool-code-exec', 'Code Exec', 'external', 'downstream-tools', 'amber', '💻', 'External code execution MCP server.', 105),
('tool-custom', 'Custom', 'external', 'downstream-tools', 'amber', '🧩', 'Custom MCP servers — hot-swappable.', 106);

-- ─── BDD/TDD Pipeline Phases ─────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, sort_order) VALUES
('phase-feature', '① Feature', 'phase', 'bdd-tdd-pipeline', 'gold', '📝', 'Write the .feature file. Describe the behaviour in Gherkin. DO NOT write any tests or code.', 111),
('phase-steps', '② Step Tests', 'phase', 'bdd-tdd-pipeline', 'cyan', '🧪', 'Write failing step definitions for this feature file. DO NOT implement any production code.', 112),
('phase-units', '③ Unit Tests', 'phase', 'bdd-tdd-pipeline', 'purple', '🧪', 'Write failing unit tests for the components you''ll need. DO NOT implement any production code.', 113),
('phase-red', '④ Red', 'phase', 'bdd-tdd-pipeline', 'red', '🔴', 'Run all tests. Confirm they fail. Report which tests fail and why. DO NOT fix anything.', 114),
('phase-green', '⑤ Green', 'phase', 'bdd-tdd-pipeline', 'green', '🟢', 'Write the minimum production code to make all tests pass. DO NOT refactor or optimise.', 115),
('phase-refactor', '⑥ Refactor', 'phase', 'bdd-tdd-pipeline', 'sky', '🔧', 'Refactor for clarity, DRY, naming. All tests must still pass. DO NOT add new functionality.', 116),
('phase-arch-review', '⑦ Arch Review', 'phase', 'bdd-tdd-pipeline', 'orange', '🏛', 'Audit against Clean Architecture standards. Report violations. DO NOT fix — only report.', 117),
('phase-sec-review', '⑧ Sec Review', 'phase', 'bdd-tdd-pipeline', 'rose', '🔒', 'Run security analysis. Check injection vectors, auth gaps, secrets exposure. DO NOT fix — only report.', 118);


-- ═══════════════════════════════════════════════════════════════════════
-- EDGES
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layer CONTAINS ──────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
-- Observability Dashboard
('observability-dashboard', 'live-dashboard', 'CONTAINS', NULL),
('observability-dashboard', 'live-process-view', 'CONTAINS', NULL),
('observability-dashboard', 'goal-task-feed', 'CONTAINS', NULL),
('observability-dashboard', 'tool-call-timeline', 'CONTAINS', NULL),
('observability-dashboard', 'security-events', 'CONTAINS', NULL),
('observability-dashboard', 'escalation-queue', 'CONTAINS', NULL),
('observability-dashboard', 'entity-explorer', 'CONTAINS', NULL),
('observability-dashboard', 'repo-map', 'CONTAINS', NULL),
('observability-dashboard', 'human-gate-dashboard', 'CONTAINS', NULL),
-- Supervisor
('supervisor-layer', 'supervisor', 'CONTAINS', NULL),
('supervisor-layer', 'dual-heartbeat', 'CONTAINS', NULL),
('supervisor-layer', 'human-gate', 'CONTAINS', NULL),
('supervisor-layer', 'fast-path-router', 'CONTAINS', NULL),
-- Task Router
('task-router-layer', 'fast-path', 'CONTAINS', NULL),
('task-router-layer', 'full-path', 'CONTAINS', NULL),
('task-router-layer', 'gated-path', 'CONTAINS', NULL),
-- Knowledge Graphs
('knowledge-graphs', 'user-knowledge-graph', 'CONTAINS', NULL),
('knowledge-graphs', 'rpg-code-graph', 'CONTAINS', NULL),
-- Dual Agents
('dual-agents', 'meta-agent', 'CONTAINS', NULL),
('dual-agents', 'worker', 'CONTAINS', NULL),
('dual-agents', 'goal-queue', 'CONTAINS', NULL),
('dual-agents', 'state-reader', 'CONTAINS', NULL),
('dual-agents', 'worker-control', 'CONTAINS', NULL),
('dual-agents', 'proxy-admin', 'CONTAINS', NULL),
('dual-agents', 'config-mutator', 'CONTAINS', NULL),
('dual-agents', 'tool-registry', 'CONTAINS', NULL),
('dual-agents', 'user-kg-read-meta', 'CONTAINS', NULL),
('dual-agents', 'user-kg-write-meta', 'CONTAINS', NULL),
('dual-agents', 'code-graph-read-meta', 'CONTAINS', NULL),
('dual-agents', 'code-graph-write-meta', 'CONTAINS', NULL),
('dual-agents', 'request-clarification', 'CONTAINS', NULL),
('dual-agents', 'check-escalation-response', 'CONTAINS', NULL),
('dual-agents', 'user-kg-read-worker', 'CONTAINS', NULL),
('dual-agents', 'code-graph-read-worker', 'CONTAINS', NULL),
-- Shared State
('shared-state', 'state-store', 'CONTAINS', NULL),
('shared-state', 'checkpointer', 'CONTAINS', NULL),
('shared-state', 'context-rebuilder', 'CONTAINS', NULL),
-- MCP Proxies
('mcp-proxies', 'mcp-proxy-meta', 'CONTAINS', NULL),
('mcp-proxies', 'mcp-proxy-worker', 'CONTAINS', NULL),
-- Security
('security-sandbox', 'sanitiser', 'CONTAINS', NULL),
('security-sandbox', 'alert-pipeline', 'CONTAINS', NULL),
-- Downstream
('downstream-tools', 'tool-search', 'CONTAINS', NULL),
('downstream-tools', 'tool-email', 'CONTAINS', NULL),
('downstream-tools', 'tool-database', 'CONTAINS', NULL),
('downstream-tools', 'tool-filesystem', 'CONTAINS', NULL),
('downstream-tools', 'tool-code-exec', 'CONTAINS', NULL),
('downstream-tools', 'tool-custom', 'CONTAINS', NULL),
-- BDD/TDD
('bdd-tdd-pipeline', 'phase-feature', 'CONTAINS', NULL),
('bdd-tdd-pipeline', 'phase-steps', 'CONTAINS', NULL),
('bdd-tdd-pipeline', 'phase-units', 'CONTAINS', NULL),
('bdd-tdd-pipeline', 'phase-red', 'CONTAINS', NULL),
('bdd-tdd-pipeline', 'phase-green', 'CONTAINS', NULL),
('bdd-tdd-pipeline', 'phase-refactor', 'CONTAINS', NULL),
('bdd-tdd-pipeline', 'phase-arch-review', 'CONTAINS', NULL),
('bdd-tdd-pipeline', 'phase-sec-review', 'CONTAINS', NULL);

-- ─── Control Flow ────────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('supervisor', 'meta-agent', 'CONTROLS', 'spawns + manages'),
('supervisor', 'worker', 'CONTROLS', 'spawns + manages'),
('supervisor', 'live-dashboard', 'CONTROLS', 'spawns'),
('meta-agent', 'worker', 'DISPATCHES_TO', 'phase-locked tasks'),
('worker', 'meta-agent', 'ESCALATES_TO', 'via state store');

-- ─── Data Flow ───────────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
-- Dashboard reads
('live-dashboard', 'state-store', 'READS_FROM', 'goals, tasks, logs'),
('live-dashboard', 'supervisor', 'READS_FROM', 'health API'),
('live-process-view', 'supervisor', 'READS_FROM', 'process status'),
('goal-task-feed', 'state-store', 'READS_FROM', 'goal queue'),
('tool-call-timeline', 'state-store', 'READS_FROM', 'tool logs'),
('security-events', 'state-store', 'READS_FROM', 'injection events'),
('escalation-queue', 'state-store', 'READS_FROM', 'escalations'),
('entity-explorer', 'user-knowledge-graph', 'READS_FROM', 'entities'),
('repo-map', 'rpg-code-graph', 'READS_FROM', 'code structure'),
-- Meta-Agent reads/writes
('meta-agent', 'state-store', 'READS_FROM', 'worker progress'),
('meta-agent', 'state-store', 'WRITES_TO', 'goals, tasks'),
('meta-agent', 'user-knowledge-graph', 'READS_FROM', 'preferences'),
('meta-agent', 'user-knowledge-graph', 'WRITES_TO', 'inferred entities'),
('meta-agent', 'rpg-code-graph', 'READS_FROM', 'repo structure'),
('meta-agent', 'rpg-code-graph', 'WRITES_TO', 'annotations'),
-- Worker reads
('worker', 'state-store', 'READS_FROM', 'task dispatch'),
('worker', 'user-knowledge-graph', 'READS_FROM', 'preferences (read-only)'),
('worker', 'rpg-code-graph', 'READS_FROM', 'code structure (read-only)'),
-- Checkpointer writes
('checkpointer', 'state-store', 'WRITES_TO', 'tool logs, checkpoints'),
('checkpointer', 'rpg-code-graph', 'WRITES_TO', 'incremental AST updates'),
-- Context rebuilder reads
('context-rebuilder', 'state-store', 'READS_FROM', 'checkpoints'),
('context-rebuilder', 'user-knowledge-graph', 'READS_FROM', 'relevant context'),
('context-rebuilder', 'rpg-code-graph', 'READS_FROM', 'relevant context');

-- ─── Proxy + Security Flow ───────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('meta-agent', 'mcp-proxy-meta', 'DEPENDS_ON', 'tool access'),
('worker', 'mcp-proxy-worker', 'DEPENDS_ON', 'tool access'),
('sanitiser', 'mcp-proxy-worker', 'SANITISES', 'all external I/O'),
('mcp-proxy-worker', 'tool-search', 'PROXIES', NULL),
('mcp-proxy-worker', 'tool-email', 'PROXIES', NULL),
('mcp-proxy-worker', 'tool-database', 'PROXIES', NULL),
('mcp-proxy-worker', 'tool-filesystem', 'PROXIES', NULL),
('mcp-proxy-worker', 'tool-code-exec', 'PROXIES', NULL),
('mcp-proxy-worker', 'tool-custom', 'PROXIES', NULL),
('alert-pipeline', 'state-store', 'WRITES_TO', 'security events'),
('alert-pipeline', 'meta-agent', 'DISPATCHES_TO', 'auto-disable alerts');

-- ─── Gating Flow ─────────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('human-gate', 'fast-path', 'GATES', 'approve/reject'),
('human-gate', 'full-path', 'GATES', 'approve/reject'),
('human-gate', 'gated-path', 'GATES', 'blocks until approved'),
('fast-path', 'worker', 'DISPATCHES_TO', 'direct'),
('full-path', 'meta-agent', 'DISPATCHES_TO', 'for decomposition');

-- ─── BDD/TDD Sequence ────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('phase-feature', 'phase-steps', 'SEQUENCE', 'commit → gate'),
('phase-steps', 'phase-units', 'SEQUENCE', 'commit → gate'),
('phase-units', 'phase-red', 'SEQUENCE', 'commit → gate'),
('phase-red', 'phase-green', 'SEQUENCE', 'commit → gate'),
('phase-green', 'phase-refactor', 'SEQUENCE', 'commit → gate'),
('phase-refactor', 'phase-arch-review', 'SEQUENCE', 'commit → gate'),
('phase-arch-review', 'phase-sec-review', 'SEQUENCE', 'commit → gate');


-- ═══════════════════════════════════════════════════════════════════════
-- NODE VERSIONS (initial — overview content extracted from HTML)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layers (overview only for now) ──────────────────────────────────
INSERT INTO node_versions (node_id, version, content, progress, status) VALUES
('observability-dashboard', 'overview', 'Read-only web UI. Process view, goal feed, tool timeline, security events, graph explorers. The single pane of glass for both observation and control.', 0, 'planned'),
('supervisor-layer', 'overview', 'The only immortal process. No LLM. Process manager + crash recovery + heartbeat. Exposes health API. Kill switch. If it dies, systemd restarts it.', 0, 'planned'),
('task-router-layer', 'overview', 'Fast path decision point. Rule engine (no LLM) routes tasks by complexity: trivial goes direct to Worker, complex goes to Meta-Agent, dangerous requires human approval.', 0, 'planned'),
('knowledge-graphs', 'overview', 'Dual graph stores. User Knowledge Graph holds domain context (people, projects, preferences). RPG Code Graph holds repo structure (files, modules, deps, data flows).', 0, 'planned'),
('dual-agents', 'overview', 'Two stock OpenCode instances. Meta-Agent (Planner) uses cheap model, plans and dispatches. Worker (Executor) uses strong model, executes one phase at a time.', 0, 'planned'),
('escalation-flow', 'overview', 'Worker ↔ Meta-Agent communication via shared state. Worker writes question to State Store, Meta-Agent responds on its own cycle. Async, no blocking RPC.', 0, 'planned'),
('shared-state', 'overview', 'SQLite WAL / Postgres. Goals, tasks, tool logs, checkpoints, escalations. The bridge between both instances — they share a database, not a connection.', 0, 'planned'),
('mcp-proxies', 'overview', 'Tool proxy layer. Meta-Agent gets static manifest (10 internal tools). Worker gets dynamic manifest (hot-swappable, sanitiser required).', 0, 'planned'),
('security-sandbox', 'overview', '3-stage sanitiser: regex heuristics → structural strip → optional LLM classifier. Fail-closed. Scans inbound + outbound. Worker proxy only.', 0, 'planned'),
('downstream-tools', 'overview', 'External MCP tool servers. Search, email, database, filesystem, code execution, custom. Hot-swappable — Meta-Agent adds/removes at runtime.', 0, 'planned'),
('bdd-tdd-pipeline', 'overview', 'Strict 8-phase pipeline enforced by Meta-Agent: Feature → Steps → Units → Red → Green → Refactor → Arch Review → Sec Review. Every phase ends with a git commit.', 0, 'planned');

-- ─── Key Components (overview + mvp planned) ─────────────────────────
INSERT INTO node_versions (node_id, version, content, progress, status) VALUES
-- Supervisor
('supervisor', 'overview', 'Manages all child processes. Heartbeat + crash recovery with tiered priority. No LLM, no planning — just process management, signal handling, and the recovery state machine. Exposes a health API (HTTP) for the dashboard.', 0, 'planned'),
('supervisor', 'mvp', 'Spawn and monitor two child processes (meta-agent, worker). Detect crashes via waitpid(). Restart crashed children with basic retry logic. Expose /health HTTP endpoint returning JSON process status. Handle SIGTERM for graceful shutdown of all children.', 0, 'planned'),
('supervisor', 'v1', 'Add exponential backoff on repeated crashes. Liveness probe (hang detection via output timeout). Recovery state machine with tiered priority (meta-agent first). Checkpoint-aware recovery — read last checkpoint before respawn. Human Gate alerting after max retries.', 0, 'planned'),
('supervisor', 'v2', 'Full config-as-code DSL for spawn configuration. Resource monitoring (memory, CPU per child). Kill switch HTTP endpoint. Dashboard SSE push for process events. Per-instance gate policies. Runtime flag switching for gate modes.', 0, 'planned'),

-- Meta-Agent
('meta-agent', 'overview', 'Stock OpenCode, planning system prompt, cheap/fast model. Plans, evaluates, dispatches. Never touches codebase or external APIs directly. Tier-0: recovered first.', 0, 'planned'),
('meta-agent', 'mvp', 'Single OpenCode instance with planning system prompt. Read goal queue, decompose into sub-tasks, dispatch to Worker via State Store. Read Worker progress from checkpoints. Basic goal → task decomposition.', 0, 'planned'),
('meta-agent', 'v1', 'Phase-locked BDD/TDD dispatch pipeline. Gate verification between phases. Escalation response handling. User KG reads for planning context. Code Graph reads for repo-aware decomposition.', 0, 'planned'),
('meta-agent', 'v2', 'Self-evolution: tool discovery + hot-swap via proxy_admin. Config mutation via DSL. Prompt evolution based on observed results. Knowledge curation — write inferred preferences to User KG. Budget and scope guardrails.', 0, 'planned'),

-- Worker
('worker', 'overview', 'Stock OpenCode, execution system prompt, strong model. Executes one phase at a time. Ephemeral and replaceable. Tier-1: recovered second.', 0, 'planned'),
('worker', 'mvp', 'Single OpenCode instance with execution system prompt. Receive task from State Store, execute with available tools, report results. Basic tool access via MCP proxy.', 0, 'planned'),
('worker', 'v1', 'Phase-locked execution (single phase per dispatch, forbidden_actions enforcement). Escalation tools (request_clarification, check_escalation_response). User KG reads for preference-aware execution. Code Graph reads for structural coherence.', 0, 'planned'),
('worker', 'v2', 'Context-aware resume after crash (transparent to the agent). Dynamic tool manifest — handles hot-swap mid-session. Confidence scoring on outputs. Full sanitiser integration on all external I/O.', 0, 'planned'),

-- State Store
('state-store', 'overview', 'Append-only log that both instances read/write. Goals, tasks, tool logs, checkpoints, escalations. The bridge between both OpenCode instances.', 0, 'planned'),
('state-store', 'mvp', 'SQLite WAL database with tables for goals, tasks, and tool_logs. Basic CRUD operations. Both agents read/write via simple SQL. No pruning, no optimization.', 0, 'planned'),
('state-store', 'v1', 'Add checkpoints table, escalation records, fast-path completion records. Context rebuilder queries. Pruning policy (keep last N days). Indexes for common query patterns.', 0, 'planned'),
('state-store', 'v2', 'SSE/WebSocket push for live dashboard updates. Postgres option for multi-machine deployments. Full audit trail with retention policies. Query optimization for dashboard views.', 0, 'planned'),

-- User Knowledge Graph
('user-knowledge-graph', 'overview', 'A persistent graph of the user''s world. Nodes are domain entities — people, projects, clients, teams, products, preferences, business rules, conventions, deadlines. Edges are typed relationships with metadata.', 0, 'planned'),
('user-knowledge-graph', 'mvp', 'SQLite-backed entity store. Add/query entities with typed relationships. Basic traversal (1-hop neighbours). Manual entity creation via CLI or dashboard. Simple text search across entities.', 0, 'planned'),
('user-knowledge-graph', 'v1', 'Meta-Agent write access for inferred entities. Confidence layering (user-explicit 1.0 > meta-inferred 0.8). Multi-hop traversal queries. Convention enforcement lookups. Deadline awareness queries.', 0, 'planned'),
('user-knowledge-graph', 'v2', 'Full graph query language. Temporal awareness (when was this preference set?). Conflict resolution for contradictory preferences. Export/import for portability. Dashboard entity editor.', 0, 'planned'),

-- RPG Code Graph
('rpg-code-graph', 'overview', 'An RPG-style structural graph of the current codebase. Encodes file hierarchy, module boundaries, inter-module data flows, function signatures, class inheritance, and import dependencies.', 0, 'planned'),
('rpg-code-graph', 'mvp', 'Static analysis on repo load using tree-sitter. Build initial graph from imports, exports, class hierarchy. Basic queries: list files in module, show imports for file. SQLite-backed.', 0, 'planned'),
('rpg-code-graph', 'v1', 'Incremental updates via Checkpointer (re-parse only changed files). Dependency traversal (topo_order, dependents). Data flow edges between modules. Pattern queries (existing patterns in a directory).', 0, 'planned'),
('rpg-code-graph', 'v2', 'Full where_to_add capability suggestions. Blast radius estimation for edits. Meta-Agent annotations (module boundaries, data flow intentions). Multi-language AST support. Visualization for dashboard Repo Map.', 0, 'planned'),

-- Sanitiser
('sanitiser', 'overview', 'Sits between Worker''s Proxy and downstream servers. ① Heuristic regex → ② Structural strip → ③ Optional LLM classifier. Fail-closed. Scans inbound + outbound.', 0, 'planned'),
('sanitiser', 'mvp', 'Regex-based heuristic scanner for common injection patterns. Structural strip (remove role tags, cap response length). Pass/block verdict on each tool response. Logging to State Store.', 0, 'planned'),
('sanitiser', 'v1', 'Outbound scanning (prevent data exfiltration via tool args). Configurable rule sets per tool. Injection frequency tracking. Auto-disable tools exceeding threshold. Dashboard integration for Security Events.', 0, 'planned'),
('sanitiser', 'v2', 'Optional LLM classifier stage for sophisticated injection detection. Adaptive rules based on observed attack patterns. Per-tool confidence scoring. Full audit trail with payload samples.', 0, 'planned'),

-- Live Dashboard
('live-dashboard', 'overview', 'Real-time view of the entire runtime. Read-only — it observes but never mutates. Built as a simple web app that polls the State Store + Supervisor health API.', 0, 'planned'),
('live-dashboard', 'mvp', 'Single-page web app showing process status (up/down) and current goal. Polls Supervisor health API every 5s. Basic goal queue display from State Store. Static HTML + vanilla JS.', 0, 'planned'),
('live-dashboard', 'v1', 'Full process tree view with live status. Goal & task feed with click-to-inspect. Tool call timeline with filtering. Security events panel. Escalation queue with response actions.', 0, 'planned'),
('live-dashboard', 'v2', 'SSE/WebSocket for real-time push updates. Entity Explorer for User KG. Repo Map for Code Graph. Embedded Human Gate approval UI. Performance metrics and resource graphs.', 0, 'planned'),

-- Checkpointer
('checkpointer', 'overview', 'Taps Worker''s Proxy. Writes after every tool response: task ID, tool name, args, result hash, timestamp. Async — doesn''t block the agent.', 0, 'planned'),
('checkpointer', 'mvp', 'Intercept tool responses from Worker proxy. Write task_id, tool_name, args_hash, result_hash, timestamp to State Store. Fire-and-forget (async, non-blocking).', 0, 'planned'),
('checkpointer', 'v1', 'Escalation state snapshots. File-edit detection triggering Code Graph AST re-parse. Plan summary snapshots for context rebuilder. Idempotency markers for crash recovery.', 0, 'planned'),
('checkpointer', 'v2', 'Configurable checkpoint granularity. Compressed checkpoint storage. Checkpoint pruning with retention policy. Metrics on checkpoint write latency.', 0, 'planned'),

-- Context Rebuilder
('context-rebuilder', 'overview', 'On crash recovery: generates resume prompt from compressed checkpoint + relevant graph context. Lossy by design — like a save game, not a VM snapshot.', 0, 'planned'),
('context-rebuilder', 'mvp', 'Read last checkpoint from State Store. Generate basic resume prompt: "you were doing X, completed Y, next step Z". Inject as system prompt on respawn.', 0, 'planned'),
('context-rebuilder', 'v1', 'Include relevant User KG context in resume prompt. Include Code Graph context for coding tasks. Handle paused:awaiting_guidance state (include escalation question + response).', 0, 'planned'),
('context-rebuilder', 'v2', 'Compressed multi-checkpoint summaries. Relevance-ranked context selection. Token budget management for resume prompts. A/B testing of resume prompt strategies.', 0, 'planned'),

-- Human Gate
('human-gate', 'overview', 'Three modes: full-auto, approve-goals, approve-all. Plus write fence for dangerous ops. Gate mode is a runtime flag.', 0, 'planned'),
('human-gate', 'mvp', 'Basic approval queue. CLI-based approve/reject. Write fence for destructive operations (hardcoded list). Block until approved or timeout.', 0, 'planned'),
('human-gate', 'v1', 'Runtime mode switching (full-auto, approve-goals, approve-all). Per-instance gate policies. Escalation forwarding from Meta-Agent. Dashboard-embeddable approval UI.', 0, 'planned'),
('human-gate', 'v2', 'Configurable write fence per tool category. Approval delegation rules. Audit trail of all gate decisions. Timeout policies with configurable fallback actions.', 0, 'planned'),

-- MCP Proxy Meta
('mcp-proxy-meta', 'overview', 'Hosts 10 planning tools (6 planning + 4 graph). Static manifest. No external API calls, no injection risk.', 0, 'planned'),
('mcp-proxy-meta', 'mvp', 'Static MCP server hosting goal_queue, state_reader, worker_control tools. Simple stdio transport. No hot-swap needed.', 0, 'planned'),

-- MCP Proxy Worker
('mcp-proxy-worker', 'overview', 'Hosts all external-facing tools + escalation + graph reads. Dynamic manifest — hot-swappable. All responses pass through Sanitiser. Circuit breaker.', 0, 'planned'),
('mcp-proxy-worker', 'mvp', 'MCP proxy with configurable tool list. Route tool calls to downstream servers. Pass responses through sanitiser. Basic health check on downstream servers.', 0, 'planned'),

-- Fast Path Router
('fast-path-router', 'overview', 'Rule engine (no LLM). Classifies tasks as fast, full, or gated. Can query User KG for context.', 0, 'planned'),
('fast-path-router', 'mvp', 'Simple rule engine: match task text against patterns (single verb, no conditionals, target file exists). Three outputs: fast, full, gated. Configurable threshold.', 0, 'planned'),

-- Dual Heartbeat
('dual-heartbeat', 'overview', 'Monitors both OpenCode instances via waitpid() + liveness probes. Instant crash detection. Exponential backoff, max 5 retries.', 0, 'planned'),
('dual-heartbeat', 'mvp', 'waitpid() loop for crash detection. Basic restart on exit. Retry counter with max limit. Log crash events.', 0, 'planned'),

-- BDD/TDD phases
('phase-feature', 'overview', 'Write the .feature file. Describe the behaviour in Gherkin. DO NOT write any tests or code. Gate: .feature file exists.', 0, 'planned'),
('phase-steps', 'overview', 'Write failing step definitions for this feature file. DO NOT implement any production code. Gate: step files exist.', 0, 'planned'),
('phase-units', 'overview', 'Write failing unit tests for the components you''ll need. DO NOT implement any production code. Gate: test files exist.', 0, 'planned'),
('phase-red', 'overview', 'Run all tests. Confirm they fail. Report which tests fail and why. DO NOT fix anything. Gate: tests fail.', 0, 'planned'),
('phase-green', 'overview', 'Write the minimum production code to make all tests pass. DO NOT refactor or optimise. Gate: tests pass.', 0, 'planned'),
('phase-refactor', 'overview', 'Refactor for clarity, DRY, naming. All tests must still pass. DO NOT add new functionality. Gate: tests still pass.', 0, 'planned'),
('phase-arch-review', 'overview', 'Audit against Clean Architecture standards. Report violations: dependency direction, layer leaks, abstraction gaps. DO NOT fix — only report. Gate: 0 violations.', 0, 'planned'),
('phase-sec-review', 'overview', 'Run security analysis. Check: injection vectors, auth gaps, secrets exposure, unsafe dependencies. DO NOT fix — only report. Gate: 0 findings.', 0, 'planned'),

-- Dashboard sub-components (overview only)
('live-process-view', 'overview', 'Process tree with real-time status: running, recovering, crashed, paused for every child. Uptime, restart count, current model, memory usage per instance.', 0, 'planned'),
('goal-task-feed', 'overview', 'Live stream of the Goal Queue. Current goal, decomposed sub-tasks, completion status. Clickable to inspect full task payloads.', 0, 'planned'),
('tool-call-timeline', 'overview', 'Chronological feed of every tool call. Shows tool name, args, response status, latency, sanitiser verdict. Filterable.', 0, 'planned'),
('security-events', 'overview', 'Sanitiser verdicts, blocked injections with raw payload preview, injection frequency per tool, auto-disable events.', 0, 'planned'),
('escalation-queue', 'overview', 'Worker escalation requests waiting for Meta-Agent or human review. Shows question, context, and available actions.', 0, 'planned'),
('entity-explorer', 'overview', 'Browse the User Knowledge Graph. See people, projects, preferences, and their relationships.', 0, 'planned'),
('repo-map', 'overview', 'Visualise the Code Graph. Module hierarchy, file deps, data flows.', 0, 'planned'),
('human-gate-dashboard', 'overview', 'Approval queue + escalation responses. Gate actions embeddable in dashboard UI.', 0, 'planned'),

-- Tools (overview only)
('goal-queue', 'overview', 'push, pop, peek, reprioritise — manages the persistent goal queue.', 0, 'planned'),
('state-reader', 'overview', 'get_checkpoint, get_task_log, get_escalations — reads Worker''s progress.', 0, 'planned'),
('worker-control', 'overview', 'dispatch, abort, respond_escalation — sends phase-locked work to Worker.', 0, 'planned'),
('proxy-admin', 'overview', 'register, deregister, list — mutates Worker''s tool manifest.', 0, 'planned'),
('config-mutator', 'overview', 'update_prompt, update_model, update_agents — evolves Worker''s config via DSL.', 0, 'planned'),
('tool-registry', 'overview', 'search, inspect, install — discovers new MCP servers from catalogue.', 0, 'planned'),
('user-kg-read-meta', 'overview', 'query, traverse, search — Meta-Agent reads User KG.', 0, 'planned'),
('user-kg-write-meta', 'overview', 'add_entity, add_edge, annotate — Meta-Agent writes to User KG.', 0, 'planned'),
('code-graph-read-meta', 'overview', 'expand, path, topo_order — Meta-Agent reads Code Graph.', 0, 'planned'),
('code-graph-write-meta', 'overview', 'annotate_module, set_data_flow — Meta-Agent writes to Code Graph.', 0, 'planned'),
('request-clarification', 'overview', 'Writes question + context snapshot to State Store. Sets task status to paused:awaiting_guidance.', 0, 'planned'),
('check-escalation-response', 'overview', 'Polls State Store for Meta-Agent''s response. Returns guidance or still_pending.', 0, 'planned'),
('user-kg-read-worker', 'overview', 'Read-only. No writes (injection safety).', 0, 'planned'),
('code-graph-read-worker', 'overview', 'Read-only. Checkpointer writes on its behalf.', 0, 'planned'),

-- Alert pipeline
('alert-pipeline', 'overview', 'Blocked injections logged to State Store. Meta-Agent can auto-disable compromised tools. Dashboard shows real-time security events.', 0, 'planned'),

-- Downstream tools (overview only)
('tool-search', 'overview', 'External search MCP server.', 0, 'planned'),
('tool-email', 'overview', 'External email MCP server.', 0, 'planned'),
('tool-database', 'overview', 'External database MCP server.', 0, 'planned'),
('tool-filesystem', 'overview', 'External filesystem MCP server.', 0, 'planned'),
('tool-code-exec', 'overview', 'External code execution MCP server.', 0, 'planned'),
('tool-custom', 'overview', 'Custom MCP servers — hot-swappable.', 0, 'planned'),

-- Fast/Full/Gated paths
('fast-path', 'overview', 'Rule engine says: single-step, unambiguous, existing tools suffice. Task goes directly to Worker. Meta-Agent notified post-completion.', 0, 'planned'),
('full-path', 'overview', 'Classifier says: multi-step, ambiguous, or needs tool changes. Task goes to Meta-Agent for decomposition.', 0, 'planned'),
('gated-path', 'overview', 'Classifier or Human Gate flags: destructive, high-cost, or security-sensitive. Task pauses for human approval.', 0, 'planned');
