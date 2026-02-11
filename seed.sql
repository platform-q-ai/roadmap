-- Living View — Seed Data (comprehensive)
-- Extracted from opencode-architecture-v3.2.html — ALL content preserved

-- ═══════════════════════════════════════════════════════════════════════
-- NODES
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layers ──────────────────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('observability-dashboard', 'Observability Dashboard', 'layer', NULL, 'sky', '📊', 'Runtime Visibility — read-only web UI that observes but never mutates. The single pane of glass for both observation and control.', '["read-only","web ui","live updates"]', 10),
('supervisor-layer', 'Supervisor', 'layer', NULL, 'purple', '👁', 'The Only Immortal Process — process management, signal handling, recovery state machine. No LLM, no planning. If it dies, systemd/Docker restarts it.', '["immortal","no llm","process manager"]', 20),
('task-router-layer', 'Task Router', 'layer', NULL, 'lime', '⚡', 'Fast Path Decision Point — lightweight rule engine (no LLM) routes tasks by complexity: trivial goes direct to Worker, complex goes to Meta-Agent, dangerous requires human approval.', '["rule engine","no llm","classifier"]', 30),
('knowledge-graphs', 'Knowledge Graphs', 'layer', NULL, 'gold', '🧠', 'Dual graph stores: User Knowledge Graph (domain context — people, projects, preferences) + RPG Code Graph (repo structure — files, modules, deps, data flows).', '["dual stores","domain context","repo structure"]', 40),
('dual-agents', 'Dual OpenCode Instances', 'layer', NULL, 'orange', '🧠', 'Two stock OpenCode instances. Meta-Agent (Planner) uses cheap/fast model (Haiku/Sonnet), plans and dispatches. Worker (Executor) uses strong model (Sonnet/Opus), executes one phase at a time. They share no tools — isolation by design.', '["stock opencode","dual instances","tool isolation"]', 50),
('escalation-flow', 'Escalation Flow', 'layer', NULL, 'teal', '🙋', 'Worker ↔ Meta-Agent communication via shared state. Worker hits ambiguity → calls request_clarification({question, context, options}) → State Store records escalation → Worker pauses → Meta-Agent picks it up on next cycle → reasons → responds via worker_control.respond_escalation → State Store updates → Worker calls check_escalation_response → receives guidance → resumes. Timeout handling: if Meta-Agent does not respond within escalation_timeout_ms, Worker can (a) proceed with best guess, (b) abort, or (c) escalate to Human Gate. Policy set in Worker system prompt.', '["async","no blocking rpc","structured payload"]', 60),
('shared-state', 'Shared State Store', 'layer', NULL, 'blue', '💾', 'The Bridge — SQLite WAL / Postgres. Goals, tasks, tool logs, checkpoints, escalations. Both instances communicate by sharing a database, not a connection.', '["sqlite wal","postgres","append-only"]', 70),
('mcp-proxies', 'MCP Proxies', 'layer', NULL, 'orange', '⇄', 'Tool proxy layer for both agent instances. Meta-Agent gets static manifest (10 internal tools, no sanitiser). Worker gets dynamic manifest (hot-swappable, sanitiser required, circuit breaker).', '["static manifest","dynamic manifest","hot-swappable"]', 80),
('security-sandbox', 'Security Sandbox', 'layer', NULL, 'red', '🛡', '3-stage sanitiser pipeline (Worker proxy only). Regex heuristics → structural strip (role tags, cap length) → optional LLM classifier. Fail-closed. Isolated subprocess. Scans inbound responses (injection defence) AND outbound tool args (prevents data exfiltration via tricked agent).', '["fail-closed","isolated subprocess","bidirectional"]', 90),
('downstream-tools', 'Downstream MCP Tool Servers', 'layer', NULL, 'amber', '🔧', 'External tool servers — search, email, database, filesystem, code execution, custom. Hot-swappable — Meta-Agent adds/removes at runtime via proxy_admin.', '["external","hot-swappable","runtime managed"]', 100),
('bdd-tdd-pipeline', 'BDD/TDD Phase Pipeline', 'layer', NULL, 'teal', '🔄', 'Strict 8-phase pipeline enforced by Meta-Agent, executed by Worker. Each phase is a separate dispatch. Worker sees only the current phase — never what comes next. Every phase ends with a git commit creating a clean rollback point. Meta-Agent verifies phase gate before advancing. If gate fails, re-dispatch same phase. Phases ⑦ and ⑧ are audit-only — violations feed back as targeted fix dispatches, then re-audit.', '["phase isolation","git commits","gate verification"]', 110);

-- ─── Observability Dashboard Components ──────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('live-dashboard', 'Live Dashboard', 'app', 'observability-dashboard', 'sky', '📊', 'Real-time view of the entire runtime. Read-only — it observes but never mutates. Built as a simple web app (React / plain HTML) that polls the State Store + Supervisor health API. Runs as a separate process managed by the Supervisor. Think: the runtime equivalent of the process tree diagram, but live. Reads from two sources: State Store (goals, tasks, tool logs, escalations, checkpoints) and Supervisor health API (process status, heartbeat data, resource usage). It writes nothing — pure read-only observer. Optional: SSE/WebSocket push from State Store for live updates without polling. Human Gate approval actions can be embedded here, making it the single pane of glass for both observation and control.', '["read-only","web ui","sse/websocket"]', 11),
('live-process-view', 'Live Process View', 'component', 'observability-dashboard', 'sky', '🔴', 'Process tree with real-time status: running, recovering, crashed, paused for every child. Uptime, restart count, current model, memory usage per instance.', '["running","recovering","crashed","paused"]', 12),
('goal-task-feed', 'Goal & Task Feed', 'component', 'observability-dashboard', 'sky', '📋', 'Live stream of the Goal Queue. Current goal, decomposed sub-tasks, completion status. See what the Meta-Agent is planning and what the Worker is executing. Clickable to inspect full task payloads.', '["live stream","clickable","task payloads"]', 13),
('tool-call-timeline', 'Tool Call Timeline', 'component', 'observability-dashboard', 'sky', '🔧', 'Chronological feed of every tool call (both instances). Shows: tool name, args (truncated), response status, latency, sanitiser verdict (pass/block). Filterable by instance, tool, and status. This is your debugging lifeline.', '["chronological","filterable","debugging lifeline"]', 14),
('security-events', 'Security Events', 'component', 'observability-dashboard', 'sky', '🛡', 'Sanitiser verdicts, blocked injections with raw payload preview, injection frequency per tool, auto-disable events. Links to full audit log entries. Alerts when injection rate exceeds threshold.', '["audit log","injection frequency","auto-disable"]', 15),
('escalation-queue', 'Escalation Queue', 'component', 'observability-dashboard', 'sky', '⏸', 'Worker escalation requests waiting for Meta-Agent or human review. Shows the Worker''s question, context snapshot, and available actions: respond, override, or abort task.', '["respond","override","abort"]', 16),
('entity-explorer', 'Entity Explorer', 'component', 'observability-dashboard', 'sky', '👤', 'Browse the User Knowledge Graph. See people, projects, preferences, and their relationships. Understand what the agents "know about you".', '["new","user kg","browse"]', 17),
('repo-map', 'Repo Map', 'component', 'observability-dashboard', 'sky', '🗺', 'Visualise the Code Graph. Module hierarchy, file deps, data flows. See the agent''s structural understanding of your codebase.', '["new","code graph","visualise"]', 18),
('human-gate-dashboard', 'Human Gate (Dashboard)', 'component', 'observability-dashboard', 'sky', '⛳', 'Approval queue + escalation responses. Gate actions embeddable in dashboard UI.', '["approval","embedded"]', 19);

-- ─── Supervisor Components ───────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('supervisor', 'Supervisor', 'app', 'supervisor-layer', 'purple', '👁', 'Manages all child processes. Heartbeat + crash recovery with tiered priority. No LLM, no planning — just process management, signal handling, and the recovery state machine. This is what makes it stable: it has almost no reasons to crash. If it does, systemd/Docker restarts it. Exposes a health API (HTTP on :9100) for the dashboard. Kill switch: /stop HTTP endpoint + SIGTERM handler → instant halt of all children. Emergency brake for runaway agents.', '["immortal","health api","kill switch","no llm"]', 21),
('dual-heartbeat', 'Dual Heartbeat', 'component', 'supervisor-layer', 'purple', '💓', 'Monitors both OpenCode instances independently via waitpid() + liveness probes. Instant crash detection (zero latency) — waitpid() returns the moment a child exits. Periodic liveness probe for hang detection — if no output for timeout_ms, treat as hung. Detects: exit, hang, OOM. If the Worker crashes → recover using Meta-Agent''s last plan. If the Meta-Agent crashes → recover it first (higher priority), then it re-dispatches the Worker. Exponential backoff, max 5 retries → alert Human Gate.', '["waitpid","zero latency","meta first","worker second","exponential backoff"]', 22),
('human-gate', 'Human Gate', 'app', 'supervisor-layer', 'pink', '⛳', 'Three modes: full-auto, approve-goals, approve-all. Plus write fence: dangerous ops require approval even in full-auto. Also surfaces escalation requests from the Worker. Write fence per-instance: Meta-Agent config mutations and Worker destructive ops can have independent gate policies. Gate mode is a runtime flag — switch between modes without restarting any process.', '["full-auto","approve-goals","approve-all","write fence","runtime flag"]', 23),
('fast-path-router', 'Fast Path Router', 'component', 'supervisor-layer', 'lime', '⚡', 'Rule engine (no LLM). Classifies tasks as fast, full, or gated. Scores incoming tasks by complexity signals: single-step? (e.g. "format this file"), no ambiguity? (clear input/output), no tool mutation needed? (current tools suffice). If all signals pass → direct to Worker, skipping Meta-Agent. Meta-Agent notified after completion via State Store. Cuts latency and cost for simple tasks by ~50%. Configurable: fast_path: "aggressive" | "conservative" | "off". Can query User KG for context ("does user prefer X for this type of task?"). If fast-path task fails, re-routed through Meta-Agent.', '["fast","full","gated","rule engine","~50% savings","new"]', 24);

-- ─── Task Router Components ──────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('fast-path', 'Fast Path', 'component', 'task-router-layer', 'lime', '⚡', 'Rule engine says: single-step, unambiguous, existing tools suffice. Task goes directly to Worker. Meta-Agent notified post-completion via State Store. Flow: task → classifier → FAST → Worker → done → State Store → Meta-Agent reads.', '["trivial","direct","skip planner"]', 31),
('full-path', 'Full Path', 'component', 'task-router-layer', 'orange', '🧠', 'Classifier says: multi-step, ambiguous, or needs tool changes. Task goes to Meta-Agent for decomposition. Normal planning loop. Flow: task → classifier → FULL → Meta-Agent → plan → dispatch → Worker → State Store.', '["complex","decomposition","planning loop"]', 32),
('gated-path', 'Gated Path', 'component', 'task-router-layer', 'purple', '⛳', 'Classifier or Human Gate flags: destructive, high-cost, or security-sensitive. Task pauses for human approval before any routing. Flow: task → classifier → GATE → Human Gate → approve → (fast or full path).', '["dangerous","approval required","security-sensitive"]', 33);

-- ─── Knowledge Graph Components ──────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('user-knowledge-graph', 'User Knowledge Graph', 'app', 'knowledge-graphs', 'gold', '👤', 'A persistent graph of the user''s world. Nodes are domain entities — people, projects, clients, teams, products, preferences, business rules, conventions, deadlines. Edges are typed relationships with metadata. This is not about code — it''s about understanding who you are and what you care about so agents make contextually appropriate decisions. Entity types: person, project, org, team, preference, convention, deadline, stack, compliance, product, domain-concept, decision. Relationship types: OWNS, PREFERS, WORKS_WITH, HAS_CLIENT, USES_STACK, REQUIRES, CONVENTION, HAS_DEADLINE, DECIDED, DISLIKES. Populated by: (1) User directly — onboarding flow or dashboard edits. (2) Meta-Agent — infers entities from conversations and patterns over time. (3) Never by Worker — same injection-safety principle. Worker reads, never writes. Confidence layering: user-explicit (1.0) > meta-agent-inferred (0.8) > auto-extracted (0.6).', '["new","persistent","entity types","relationship types","confidence layering"]', 41),
('rpg-code-graph', 'RPG Code Graph', 'app', 'knowledge-graphs', 'emerald', '🗺', 'An RPG-style structural graph of the current codebase. Encodes file hierarchy, module boundaries, inter-module data flows, function signatures, class inheritance, and import dependencies. Inspired by Microsoft RPG/ZeroRepo (https://arxiv.org/abs/2509.16198). This is a code quality feature — it helps the Worker write structurally coherent code by understanding what exists, what depends on what, and where new code should go. Node types: module, file, function, class, interface, package, route, schema, test. Edge types: CONTAINS, IMPORTS, EXPORTS, DATA_FLOW, EXTENDS, IMPLEMENTS, DEPENDS_ON, TESTS, CALLS. Populated by: (1) Static analysis on init — AST parse via tree-sitter on repo load (~seconds for repos under 100K LoC). (2) Worker''s Checkpointer — auto-updates after file edits (re-parse only changed files, diff old vs new, update edges incrementally). (3) Meta-Agent — can annotate with higher-level module boundaries and data flow intentions. Lightweight — no LLM needed for extraction. Query patterns: topo_order(module), data_flow(A,B), dependents(file), pattern(type,dir), where_to_add(capability).', '["new","tree-sitter","ast parsing","disposable","re-derivable","query patterns"]', 42);

-- ─── Dual Agent Components ───────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('meta-agent', 'Meta-Agent (Planner)', 'app', 'dual-agents', 'orange', '🧠', 'Stock OpenCode, planning system prompt, cheap/fast model (Haiku/Sonnet). This instance never touches the codebase or external APIs directly. It only plans, evaluates, and dispatches. Tier-0: recovered first. If this is down, the Worker has no direction. Only internal tools, no injection surface. Traverses User KG to align plans with user preferences, deadlines, team context. Reads Code Graph to understand repo structure before decomposing coding tasks. Also handles escalation responses: reads Worker''s request_clarification entries from State Store, reasons about them, and writes guidance back — which the Worker receives on its next checkpoint resume or via check_escalation_response tool. System prompt: "You are a task planner. Use your tools to: read the goal queue, check worker status, decompose goals into tasks, dispatch tasks, evaluate results, and generate follow-up goals. You may also evolve the worker''s tools and config when needed." The loop emerges from the prompt + tool availability.', '["tier-0","10 internal tools","reads/writes user kg","reads code graph","haiku/sonnet","new"]', 51),
('worker', 'Worker (Executor)', 'app', 'dual-agents', 'cyan', '⚡', 'Stock OpenCode, execution system prompt, strong model (Sonnet/Opus). Tier-1, ephemeral, no fork. Lower stability priority — if it crashes, the Meta-Agent re-dispatches. Treated as ephemeral and replaceable. On recovery, the agent continues without knowing it crashed — the Context Rebuilder injects a resume prompt that makes it look like a natural continuation. External tools, sanitiser required. Reads User KG to respect user preferences during execution (naming conventions, tech choices). Traverses Code Graph to write structurally coherent code (dependency-aware edits, correct placement). Has two escalation tools: request_clarification to pause and ask the planner for guidance, and check_escalation_response to poll for an answer. System prompt: "If you''re uncertain about scope, direction, or trade-offs, use request_clarification. Don''t guess — ask." Receives tasks as structured system prompt injections: phase, task, constraints, forbidden_actions, available_tools, success_criteria. Single-phase isolation: the Worker sees "Write failing step tests for this feature file. DO NOT implement any production code." It literally cannot skip ahead because it doesn''t know what "ahead" is. The forbidden_actions field explicitly lists what it must not do (e.g. ["create production files", "modify existing src/", "run tests in watch mode"]).', '["tier-1","dynamic tools","reads user kg","reads code graph","sanitiser required","ephemeral","no fork","sonnet/opus","new"]', 52),
('goal-queue', 'goal_queue', 'component', 'dual-agents', 'orange', '📋', 'push, pop, peek, reprioritise — manages the persistent goal queue.', '["meta-agent tool"]', 53),
('state-reader', 'state_reader', 'component', 'dual-agents', 'orange', '📖', 'get_checkpoint, get_task_log, get_escalations — reads Worker''s progress.', '["meta-agent tool"]', 54),
('worker-control', 'worker_control', 'component', 'dual-agents', 'orange', '🔧', 'dispatch, abort, respond_escalation — sends phase-locked work to Worker. Dispatch includes phase, forbidden_actions, success_criteria.', '["meta-agent tool","phase-locked"]', 55),
('proxy-admin', 'proxy_admin', 'component', 'dual-agents', 'orange', '📡', 'register, deregister, list — mutates Worker''s tool manifest at runtime.', '["meta-agent tool","hot-swap"]', 56),
('config-mutator', 'config_mutator', 'component', 'dual-agents', 'orange', '⚙', 'update_prompt, update_model, update_agents — evolves Worker''s config via typed builder DSL. Validated, versioned, rollback-safe. Not raw JSON editing.', '["meta-agent tool","dsl","rollback-safe"]', 57),
('tool-registry', 'tool_registry', 'component', 'dual-agents', 'orange', '🔍', 'search, inspect, install — discovers new MCP servers from a catalogue.', '["meta-agent tool","discovery"]', 58),
('user-kg-read-meta', 'user_kg_read (Meta)', 'component', 'dual-agents', 'gold', '👤', 'query, traverse, search — Meta-Agent reads User KG for planning context.', '["meta-agent tool","new"]', 59),
('user-kg-write-meta', 'user_kg_write (Meta)', 'component', 'dual-agents', 'gold', '✏', 'add_entity, add_edge, annotate — Meta-Agent writes inferred entities to User KG.', '["meta-agent tool","new"]', 60),
('code-graph-read-meta', 'code_graph_read (Meta)', 'component', 'dual-agents', 'emerald', '🗺', 'expand, path, topo_order — Meta-Agent reads Code Graph for repo-aware decomposition.', '["meta-agent tool","new"]', 61),
('code-graph-write-meta', 'code_graph_write (Meta)', 'component', 'dual-agents', 'emerald', '✏', 'annotate_module, set_data_flow — Meta-Agent annotates Code Graph with module boundaries and data flow intentions.', '["meta-agent tool","new"]', 62),
('request-clarification', 'request_clarification', 'component', 'dual-agents', 'teal', '🙋', 'Writes question + context snapshot to State Store. Sets task status to paused:awaiting_guidance. Worker halts current execution and waits.', '["worker tool","escalation"]', 63),
('check-escalation-response', 'check_escalation_response', 'component', 'dual-agents', 'teal', '📨', 'Polls State Store for Meta-Agent''s response. Returns guidance or still_pending. Worker resumes when guidance arrives.', '["worker tool","escalation"]', 64),
('user-kg-read-worker', 'user_kg_read (Worker)', 'component', 'dual-agents', 'gold', '👤', 'Read-only. No writes (injection safety). Worker reads preferences but cannot poison the knowledge graph even if fully compromised.', '["worker tool","read-only","new"]', 65),
('code-graph-read-worker', 'code_graph_read (Worker)', 'component', 'dual-agents', 'emerald', '🗺', 'Read-only. Checkpointer writes on Worker''s behalf after file edits trigger AST re-parse.', '["worker tool","read-only","new"]', 66);

-- ─── Shared State Components ─────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('state-store', 'State Store', 'app', 'shared-state', 'blue', '💾', 'Append-only log that both instances read/write. The Meta-Agent writes goals and reads results. The Worker''s Checkpointer writes tool call logs and progress. This is how the two OpenCode instances communicate without direct coupling — they share a database, not a connection. Also stores escalation records (question, context, response, status) and fast-path completion records so the Meta-Agent stays aware of tasks it didn''t plan. Dashboard reads everything here.', '["checkpointer","context rebuilder","crash recovery"]', 71),
('checkpointer', 'Checkpointer', 'app', 'shared-state', 'blue', '📸', 'Taps Worker''s Proxy. Writes after every tool response: task ID, tool name, args, result hash, timestamp, plan summary. Also snapshots escalation state so crash recovery can restore a paused-and-waiting Worker correctly. If tool was a file edit, also triggers AST re-parse and Code Graph update. Strategy: tool results are facts; LLM reasoning can be re-derived. So we save the facts (tool call + result) and let the Context Rebuilder regenerate the reasoning frame on recovery. Runs async — doesn''t block the agent. The proxy fires-and-forgets to the checkpointer; the Worker never waits for a checkpoint write to complete.', '["async","fire-and-forget","non-blocking","code graph update"]', 72),
('context-rebuilder', 'Context Rebuilder', 'app', 'shared-state', 'blue', '📝', 'On crash recovery of either instance: generates resume prompt from compressed checkpoint + relevant graph context. For Worker: "you were doing X, completed Y, next step Z". For Meta-Agent: "current goal is X, worker status is Y, pending goals are Z". If Worker was in paused:awaiting_guidance state, resume prompt includes the escalation question and any response received while it was down. Lossy by design. You can''t clone LLM hidden state — it''s non-serialisable. This is like a save game, not a VM snapshot. The rebuilt context is "good enough" — the agent continues without knowing it crashed, picking up from the last checkpoint with a compressed summary of what came before.', '["lossy by design","save game","resume prompt"]', 73);

-- ─── MCP Proxy Components ────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('mcp-proxy-meta', 'MCP Proxy — Meta-Agent', 'app', 'mcp-proxies', 'orange', '⇄', 'Hosts 10 planning tools (6 planning + 4 graph). These are your custom MCP servers — small, stable, purpose-built. No external API calls, no injection risk.', '["static","no sanitiser","low risk"]', 81),
('mcp-proxy-worker', 'MCP Proxy — Worker', 'app', 'mcp-proxies', 'cyan', '⇄', 'Hosts all external-facing tools + escalation + graph reads. Dynamic manifest — the Meta-Agent''s proxy_admin tool adds/removes servers here at runtime. All responses pass through the Sanitiser. Health & circuit breaker: heartbeats downstream servers; dead endpoints auto-removed from manifest, Meta-Agent notified via State Store so it can find replacements.', '["sanitiser required","hot-swappable","checkpoint tap","circuit breaker"]', 82);

-- ─── Security Components ─────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('sanitiser', '3-Stage Sanitiser', 'app', 'security-sandbox', 'red', '🛡', 'Sits between Worker''s Proxy and downstream servers. Stage 1: Heuristic regex for common injection patterns. Stage 2: Structural strip (remove role tags, cap response length). Stage 3: Optional LLM classifier for sophisticated detection. The Meta-Agent''s proxy does NOT need a sanitiser — its tools are all internal, no external input. Isolated subprocess. Fail-closed. Scans inbound responses (injection defence) and outbound tool args (prevents data exfiltration via a tricked agent — e.g. an injected prompt that encodes secrets into a search query). Injection events visible in dashboard Security Events panel.', '["3-stage","fail-closed","isolated subprocess","bidirectional"]', 91),
('alert-pipeline', 'Alert Pipeline', 'component', 'security-sandbox', 'red', '📋', 'Blocked injections logged to State Store. Meta-Agent can auto-disable compromised tools via injection feedback loop — reads sanitiser alerts and learns to avoid them. Dashboard shows real-time security events feed.', '["auto-disable","injection feedback loop","real-time"]', 92);

-- ─── Downstream Tools ────────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('tool-search', 'Search', 'external', 'downstream-tools', 'amber', '🔍', 'External search MCP server.', '["ext"]', 101),
('tool-email', 'Email', 'external', 'downstream-tools', 'amber', '✉', 'External email MCP server.', '["ext"]', 102),
('tool-database', 'Database', 'external', 'downstream-tools', 'amber', '🗄', 'External database MCP server.', '["write"]', 103),
('tool-filesystem', 'Filesystem', 'external', 'downstream-tools', 'amber', '📂', 'External filesystem MCP server.', '["write"]', 104),
('tool-code-exec', 'Code Exec', 'external', 'downstream-tools', 'amber', '💻', 'External code execution MCP server.', '["write"]', 105),
('tool-custom', 'Custom', 'external', 'downstream-tools', 'amber', '🧩', 'Custom MCP servers — hot-swappable, added/removed by Meta-Agent at runtime.', '["dynamic"]', 106);

-- ─── Standalone Apps ────────────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order, current_version) VALUES
('roadmap', 'Roadmap', 'app', NULL, 'cyan', '🗺', 'Living documentation for the Open Autonomous Runtime. Self-tracking component with progression tree, versioned specs, and Gherkin feature files. Built with Clean Architecture, TypeScript, SQLite, and Cytoscape.js.', '["self-tracking","clean architecture","bdd","progression tree"]', 1, '0.1.0');

-- ─── BDD/TDD Pipeline Phases ─────────────────────────────────────────
INSERT INTO nodes (id, name, type, layer, color, icon, description, tags, sort_order) VALUES
('phase-feature', '① Feature', 'phase', 'bdd-tdd-pipeline', 'gold', '📝', 'Write the .feature file. Describe the behaviour in Gherkin. DO NOT write any tests or code. Gate: .feature file exists. Git commit after phase.', '["gherkin","gate: .feature exists"]', 111),
('phase-steps', '② Step Tests', 'phase', 'bdd-tdd-pipeline', 'cyan', '🧪', 'Write failing step definitions for this feature file. DO NOT implement any production code. Gate: step files exist. Git commit after phase.', '["failing tests","gate: step files exist"]', 112),
('phase-units', '③ Unit Tests', 'phase', 'bdd-tdd-pipeline', 'purple', '🧪', 'Write failing unit tests for the components you''ll need. DO NOT implement any production code. Gate: test files exist. Git commit after phase.', '["failing tests","gate: test files exist"]', 113),
('phase-red', '④ Red', 'phase', 'bdd-tdd-pipeline', 'red', '🔴', 'Run all tests. Confirm they fail. Report which tests fail and why. DO NOT fix anything. Gate: tests fail. Git commit after phase.', '["confirm failure","gate: tests fail"]', 114),
('phase-green', '⑤ Green', 'phase', 'bdd-tdd-pipeline', 'green', '🟢', 'Write the minimum production code to make all tests pass. DO NOT refactor or optimise. Gate: tests pass. Git commit after phase.', '["minimum code","gate: tests pass"]', 115),
('phase-refactor', '⑥ Refactor', 'phase', 'bdd-tdd-pipeline', 'sky', '🔧', 'Refactor for clarity, DRY, naming. All tests must still pass. DO NOT add new functionality. Gate: tests still pass. Git commit after phase.', '["clarity","dry","gate: tests still pass"]', 116),
('phase-arch-review', '⑦ Arch Review', 'phase', 'bdd-tdd-pipeline', 'orange', '🏛', 'LLM-driven audit agent (not a linter). Audit against Clean Architecture standards. Report violations: dependency direction (inner layers importing outer), layer boundary leaks (business logic in controllers, HTTP in domain), abstraction leaks (SQL in repository interface), use case isolation. Traverses Code Graph DATA_FLOW and IMPORTS edges to verify dependency direction structurally. DO NOT fix — only report. Report format: {violations: [{file, line, rule, severity, explanation}], passed: bool}. If violations found, Meta-Agent dispatches targeted fix phases then re-runs this review. Gate: 0 violations. Git commit after phase.', '["audit-only","clean architecture","gate: 0 violations"]', 117),
('phase-sec-review', '⑧ Sec Review', 'phase', 'bdd-tdd-pipeline', 'rose', '🔒', 'LLM-driven security audit agent. Check: injection vectors (SQL, XSS, command injection, path traversal), auth/authz gaps (endpoints without auth middleware, missing permission checks, privilege escalation), secrets exposure (hardcoded keys, tokens in logs, secrets in error messages, .env leaks), unsafe dependencies (known CVEs, deprecated crypto, insecure defaults). Checks compliance requirements from User KG (e.g. "client requires SOC2" → enforce specific controls). DO NOT fix — only report. Same report format as Arch Review. Gate: 0 findings. Git commit after phase.', '["audit-only","security","gate: 0 findings","user kg compliance"]', 118);


-- ═══════════════════════════════════════════════════════════════════════
-- EDGES (unchanged from original — already comprehensive)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layer CONTAINS ──────────────────────────────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('observability-dashboard', 'live-dashboard', 'CONTAINS', NULL),
('observability-dashboard', 'live-process-view', 'CONTAINS', NULL),
('observability-dashboard', 'goal-task-feed', 'CONTAINS', NULL),
('observability-dashboard', 'tool-call-timeline', 'CONTAINS', NULL),
('observability-dashboard', 'security-events', 'CONTAINS', NULL),
('observability-dashboard', 'escalation-queue', 'CONTAINS', NULL),
('observability-dashboard', 'entity-explorer', 'CONTAINS', NULL),
('observability-dashboard', 'repo-map', 'CONTAINS', NULL),
('observability-dashboard', 'human-gate-dashboard', 'CONTAINS', NULL),
('supervisor-layer', 'supervisor', 'CONTAINS', NULL),
('supervisor-layer', 'dual-heartbeat', 'CONTAINS', NULL),
('supervisor-layer', 'human-gate', 'CONTAINS', NULL),
('supervisor-layer', 'fast-path-router', 'CONTAINS', NULL),
('task-router-layer', 'fast-path', 'CONTAINS', NULL),
('task-router-layer', 'full-path', 'CONTAINS', NULL),
('task-router-layer', 'gated-path', 'CONTAINS', NULL),
('knowledge-graphs', 'user-knowledge-graph', 'CONTAINS', NULL),
('knowledge-graphs', 'rpg-code-graph', 'CONTAINS', NULL),
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
('shared-state', 'state-store', 'CONTAINS', NULL),
('shared-state', 'checkpointer', 'CONTAINS', NULL),
('shared-state', 'context-rebuilder', 'CONTAINS', NULL),
('mcp-proxies', 'mcp-proxy-meta', 'CONTAINS', NULL),
('mcp-proxies', 'mcp-proxy-worker', 'CONTAINS', NULL),
('security-sandbox', 'sanitiser', 'CONTAINS', NULL),
('security-sandbox', 'alert-pipeline', 'CONTAINS', NULL),
('downstream-tools', 'tool-search', 'CONTAINS', NULL),
('downstream-tools', 'tool-email', 'CONTAINS', NULL),
('downstream-tools', 'tool-database', 'CONTAINS', NULL),
('downstream-tools', 'tool-filesystem', 'CONTAINS', NULL),
('downstream-tools', 'tool-code-exec', 'CONTAINS', NULL),
('downstream-tools', 'tool-custom', 'CONTAINS', NULL),
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
('live-dashboard', 'state-store', 'READS_FROM', 'goals, tasks, logs'),
('live-dashboard', 'supervisor', 'READS_FROM', 'health API'),
('live-process-view', 'supervisor', 'READS_FROM', 'process status'),
('goal-task-feed', 'state-store', 'READS_FROM', 'goal queue'),
('tool-call-timeline', 'state-store', 'READS_FROM', 'tool logs'),
('security-events', 'state-store', 'READS_FROM', 'injection events'),
('escalation-queue', 'state-store', 'READS_FROM', 'escalations'),
('entity-explorer', 'user-knowledge-graph', 'READS_FROM', 'entities'),
('repo-map', 'rpg-code-graph', 'READS_FROM', 'code structure'),
('meta-agent', 'state-store', 'READS_FROM', 'worker progress'),
('meta-agent', 'state-store', 'WRITES_TO', 'goals, tasks'),
('meta-agent', 'user-knowledge-graph', 'READS_FROM', 'preferences'),
('meta-agent', 'user-knowledge-graph', 'WRITES_TO', 'inferred entities'),
('meta-agent', 'rpg-code-graph', 'READS_FROM', 'repo structure'),
('meta-agent', 'rpg-code-graph', 'WRITES_TO', 'annotations'),
('worker', 'state-store', 'READS_FROM', 'task dispatch'),
('worker', 'user-knowledge-graph', 'READS_FROM', 'preferences (read-only)'),
('worker', 'rpg-code-graph', 'READS_FROM', 'code structure (read-only)'),
('checkpointer', 'state-store', 'WRITES_TO', 'tool logs, checkpoints'),
('checkpointer', 'rpg-code-graph', 'WRITES_TO', 'incremental AST updates'),
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

-- ─── App Dependency Graph (Progression Tree) ────────────────────────
INSERT INTO edges (source_id, target_id, type, label) VALUES
('supervisor', 'state-store', 'DEPENDS_ON', 'reads checkpoints'),
('checkpointer', 'state-store', 'DEPENDS_ON', 'writes checkpoints'),
('context-rebuilder', 'state-store', 'DEPENDS_ON', 'reads checkpoints'),
('meta-agent', 'supervisor', 'DEPENDS_ON', 'spawned by supervisor'),
('worker', 'supervisor', 'DEPENDS_ON', 'spawned by supervisor'),
('mcp-proxy-meta', 'meta-agent', 'DEPENDS_ON', 'serves meta-agent tools'),
('mcp-proxy-worker', 'worker', 'DEPENDS_ON', 'serves worker tools'),
('sanitiser', 'mcp-proxy-worker', 'DEPENDS_ON', 'wraps worker proxy'),
('live-dashboard', 'state-store', 'DEPENDS_ON', 'reads all state'),
('live-dashboard', 'supervisor', 'DEPENDS_ON', 'reads health API'),
('human-gate', 'state-store', 'DEPENDS_ON', 'reads/writes approvals'),
('context-rebuilder', 'user-knowledge-graph', 'DEPENDS_ON', 'reads context'),
('context-rebuilder', 'rpg-code-graph', 'DEPENDS_ON', 'reads context');

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
-- NODE VERSIONS — comprehensive content with callouts and notes folded in
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Layers ──────────────────────────────────────────────────────────
INSERT INTO node_versions (node_id, version, content, progress, status) VALUES
('observability-dashboard', 'overview', 'Read-only web UI. Process view, goal feed, tool timeline, security events, graph explorers. The dashboard is a thin web UI (React / plain HTML) that reads from two sources: the State Store (goals, tasks, tool logs, escalations, checkpoints) and the Supervisor''s health API (process status, heartbeat data, resource usage). It writes nothing — pure read-only observer. Optional: SSE/WebSocket push from State Store for live updates without polling. The Human Gate approval actions can be embedded here too, making it the single pane of glass for both observation and control.', 0, 'planned'),
('supervisor-layer', 'overview', 'The only immortal process. No LLM. Process manager + crash recovery + heartbeat. Exposes health API on :9100. Kill switch: /stop HTTP endpoint + SIGTERM handler. If it dies, systemd/Docker restarts it. Recovery sequence on crash detection: (1) Kill hung process if still alive. (2) Read last checkpoint from State Store. (3) Rebuild config via DSL. (4) Inject resume context via Context Rebuilder. (5) Respawn fresh OpenCode process (new PID, clean slate, resume prompt). (6) Exponential backoff if repeated failures, max 5 retries → alert Human Gate.', 0, 'planned'),
('task-router-layer', 'overview', 'Fast path decision point. Rule engine (no LLM) routes tasks by complexity. Classifier is NOT an LLM — it''s a rule engine (regex + heuristics on task text). Signals: single verb ("format", "lint", "rename"), no conditional language, target file exists, current tools suffice. Configurable threshold: fast_path: "aggressive" | "conservative" | "off". Meta-Agent stays aware: fast-path completions logged to State Store. Fallback: if fast-path task fails, re-routed through Meta-Agent.', 0, 'planned'),
('knowledge-graphs', 'overview', 'Dual graph stores. User Knowledge Graph holds domain context (people, projects, preferences). RPG Code Graph holds repo structure (files, modules, deps, data flows). Three stores, three purposes: State Store (operational — what''s happening now, prunable), User KG (domain — who you are, long-lived), Code Graph (repo structure — what the codebase looks like, disposable and re-derivable from code).', 0, 'planned'),
('dual-agents', 'overview', 'Two stock OpenCode instances. Meta-Agent (Planner) uses cheap model (Haiku/Sonnet), plans and dispatches. Worker (Executor) uses strong model (Sonnet/Opus), executes one phase at a time. Why two instances? (1) Separation of concerns: planning and execution have different tool sets, models, cost profiles, and risk levels. (2) Blast radius: a prompt injection in the Worker can''t reach the Planner — they share no tools or MCP connection. (3) Independent recovery: Worker can crash and be re-dispatched without losing Meta-Agent''s plan state. (4) Cost optimisation: Planner uses cheap model, Worker uses capable model. (5) Dogfooding: you build one runtime, not two systems. Both instances use the same config DSL, proxy, and checkpoint infra.', 0, 'planned'),
('escalation-flow', 'overview', 'Worker ↔ Meta-Agent communication via shared state. Escalation sequence: Worker hits ambiguity → calls request_clarification({question, context, options}) → State Store records with status pending → Worker pauses (returns control to idle loop) → Meta-Agent''s state_reader.get_escalations() picks it up → Meta-Agent reasons → calls worker_control.respond_escalation({task_id, guidance}) → State Store updates to resolved → Worker calls check_escalation_response() → receives guidance → resumes. Timeout: if no response within escalation_timeout_ms, Worker can: (a) proceed_best_guess, (b) abort, or (c) escalate_to_human. Design: Worker stays isolated (writes to State Store, not to Meta-Agent directly). Async by design (no blocking RPC). Structured payload: {question, context_snapshot, suggested_options[], urgency}. Crash safety: Checkpointer snapshots escalation state.', 0, 'planned'),
('shared-state', 'overview', 'SQLite WAL / Postgres. Goals, tasks, tool logs, checkpoints, escalations. The bridge between both instances — they share a database, not a connection. Context preservation: What IS saved — task ID + current step index, tool call log (name, args, result hash), plan summary (goal queue snapshot), goal queue pointer, timestamps, escalation state. What is NOT saved — LLM hidden state (non-serialisable), full conversation history (too large), in-flight reasoning (ephemeral by nature). Tool results are facts; LLM reasoning can be re-derived.', 0, 'planned'),
('mcp-proxies', 'overview', 'Tool proxy layer. Meta-Agent gets static manifest (10 internal tools, no sanitiser, low risk). Worker gets dynamic manifest (hot-swappable, sanitiser required, circuit breaker, checkpoint tap).', 0, 'planned'),
('security-sandbox', 'overview', '3-stage sanitiser: regex heuristics → structural strip → optional LLM classifier. Fail-closed. Isolated subprocess. Scans inbound + outbound. Worker proxy only. Security model: Meta-Agent has no sanitiser (internal tools only). Worker has full 3-stage sanitiser. Cross-instance isolation: Worker cannot reach Meta-Agent''s tools even if fully compromised. Escalation tools are safe: they write structured data to State Store, not free-text to Meta-Agent''s prompt. Dashboard is read-only — cannot be used as attack vector. Graph writes: Worker cannot write to either graph — cannot poison knowledge even if fully compromised. In full-auto mode: sanitiser is the only defence against prompt injection. Write fence still applies for destructive ops. Injection feedback loop lets Meta-Agent auto-disable compromised tools.', 0, 'planned'),
('downstream-tools', 'overview', 'External MCP tool servers. Search, email, database, filesystem, code execution, custom. Hot-swappable — Meta-Agent adds/removes at runtime.', 0, 'planned'),
('bdd-tdd-pipeline', 'overview', 'Strict 8-phase pipeline enforced by Meta-Agent: Feature → Steps → Units → Red → Green → Refactor → Arch Review → Sec Review. Every phase ends with a git commit. LLM agents are bad at process discipline. Given "build a login feature", they''ll jump straight to implementation, skip tests, or refactor before proving anything works. Phase isolation prevents this — the Worker can''t skip ahead because it doesn''t know what "ahead" is. The forbidden_actions field explicitly blocks forward-leaking behaviour. This turns the Meta-Agent into a process enforcer, not just a task decomposer. Review phases ⑦ ⑧ are audit-only — dispatched as read-only inspections. Worker reports violations but is forbidden from modifying code. Meta-Agent reads the report, dispatches separate fix phases with specific violations as constraints. Prevents the "fix one thing, break another" cascade. Phases are extensible: add performance review, accessibility audit, API design review — same pattern.', 0, 'planned');

-- ─── Key Components ──────────────────────────────────────────────────
-- Supervisor
INSERT INTO node_versions (node_id, version, content, progress, status) VALUES
('supervisor', 'overview', 'Manages all child processes. Heartbeat + crash recovery with tiered priority. No LLM, no planning — just process management, signal handling, and the recovery state machine. This is what makes it stable: it has almost no reasons to crash. If it does, systemd/Docker restarts it. Exposes a health API (HTTP on :9100) for the dashboard. Kill switch: /stop HTTP endpoint + SIGTERM handler → instant halt of all children. Why a Supervisor, not a cron job? (1) Instant detection: waitpid() returns the moment a child exits. Cron''s worst-case latency = poll interval. (2) Crash loop handling: Supervisor tracks restart count + applies exponential backoff. (3) Multi-step recovery: kill → checkpoint read → config rebuild → context inject → respawn. (4) Lifecycle ownership: Supervisor owns the full process tree — PIDs, health, state. (5) Signal handling: catches SIGTERM/SIGCHLD and coordinates graceful shutdown. Stability hierarchy: Tier ∞ (Supervisor) immortal → Tier 0 (Meta-Agent) recovered first → Tier 1 (Worker) expendable. Recovery order: Supervisor → Meta-Agent → Worker. Each tier can recover the one below it.', 0, 'planned'),
('supervisor', 'mvp', 'Spawn and monitor two child processes (meta-agent, worker). Detect crashes via waitpid(). Restart crashed children with basic retry logic. Expose /health HTTP endpoint returning JSON process status. Handle SIGTERM for graceful shutdown of all children.', 0, 'planned'),
('supervisor', 'v1', 'Add exponential backoff on repeated crashes. Liveness probe (hang detection via output timeout_ms). Recovery state machine with tiered priority (meta-agent first). Checkpoint-aware recovery — read last checkpoint before respawn. Human Gate alerting after max 5 retries.', 0, 'planned'),
('supervisor', 'v2', 'Full config-as-code DSL for spawn configuration. Resource monitoring (memory, CPU per child). Kill switch /stop HTTP endpoint. Dashboard SSE push for process events. Per-instance gate policies. Runtime flag switching for gate modes.', 0, 'planned'),

-- Meta-Agent
('meta-agent', 'overview', 'Stock OpenCode, planning system prompt, cheap/fast model (Haiku/Sonnet). This instance never touches the codebase or external APIs directly. It only plans, evaluates, and dispatches. Tier-0: recovered first. If this is down, the Worker has no direction. Only internal tools, no injection surface. Traverses User KG to align plans with user preferences, deadlines, team context. Reads Code Graph to understand repo structure before decomposing coding tasks. Also handles escalation responses: reads Worker''s request_clarification entries from State Store, reasons about them, and writes guidance back. System prompt: "You are a task planner. Use your tools to: read the goal queue, check worker status, decompose goals into tasks, dispatch tasks, evaluate results, and generate follow-up goals. You may also evolve the worker''s tools and config when needed." The loop emerges from the prompt + tool availability. How Meta-Agent uses both graphs: Before planning — "What stack? Deadlines? Preferences?" Before decomposing — "Which modules? Dependency order? Blast radius?" Task dispatch enrichment — includes relevant KG + Code Graph context in Worker''s task prompt. Tool selection — User KG says "prefers Brave over Google" → configures proxy. Knowledge curation — writes inferred preferences to User KG. Self-evolution: tool discovery via tool_registry.search, config mutation via typed builder DSL (not raw JSON), sub-goal generation, prompt evolution based on observed results. Guardrails: budget limits, scope limits, allowed tool categories, model whitelist.', 0, 'planned'),
('meta-agent', 'mvp', 'Single OpenCode instance with planning system prompt. Read goal queue, decompose into sub-tasks, dispatch to Worker via State Store. Read Worker progress from checkpoints. Basic goal → task decomposition.', 0, 'planned'),
('meta-agent', 'v1', 'Phase-locked BDD/TDD dispatch pipeline. Gate verification between phases. Escalation response handling. User KG reads for planning context. Code Graph reads for repo-aware decomposition.', 0, 'planned'),
('meta-agent', 'v2', 'Self-evolution: tool discovery + hot-swap via proxy_admin. Config mutation via DSL. Prompt evolution based on observed results. Knowledge curation — write inferred preferences to User KG. Budget and scope guardrails.', 0, 'planned'),

-- Worker
('worker', 'overview', 'Stock OpenCode, execution system prompt, strong model (Sonnet/Opus). Tier-1, ephemeral, no fork. Lower stability priority — if it crashes, the Meta-Agent re-dispatches. Treated as ephemeral and replaceable. On recovery, the agent continues without knowing it crashed — the Context Rebuilder injects a resume prompt that makes it look like a natural continuation. External tools, sanitiser required. Reads User KG to respect user preferences during execution. Traverses Code Graph for structurally coherent code. Has escalation tools: request_clarification and check_escalation_response. System prompt: "If you''re uncertain about scope, direction, or trade-offs, use request_clarification. Don''t guess — ask." Receives tasks as structured injections: phase, task, constraints, forbidden_actions, available_tools, success_criteria. Single-phase isolation: Worker sees only current phase, never what comes next. Example forbidden_actions: ["create production files", "modify existing src/", "run tests in watch mode"]. The Worker literally cannot skip ahead because it doesn''t know what "ahead" is.', 0, 'planned'),
('worker', 'mvp', 'Single OpenCode instance with execution system prompt. Receive task from State Store, execute with available tools, report results. Basic tool access via MCP proxy.', 0, 'planned'),
('worker', 'v1', 'Phase-locked execution (single phase per dispatch, forbidden_actions enforcement). Escalation tools (request_clarification, check_escalation_response). User KG reads for preference-aware execution. Code Graph reads for structural coherence.', 0, 'planned'),
('worker', 'v2', 'Context-aware resume after crash (transparent to agent). Dynamic tool manifest — handles hot-swap mid-session. Confidence scoring on outputs. Full sanitiser integration on all external I/O.', 0, 'planned'),

-- State Store
('state-store', 'overview', 'Append-only log that both instances read/write. The Meta-Agent writes goals and reads results. The Worker''s Checkpointer writes tool call logs and progress. This is how the two OpenCode instances communicate without direct coupling — they share a database, not a connection. Also stores escalation records (question, context, response, status) and fast-path completion records so the Meta-Agent stays aware of tasks it didn''t plan. Dashboard reads everything here.', 0, 'planned'),
('state-store', 'mvp', 'SQLite WAL database with tables for goals, tasks, and tool_logs. Basic CRUD operations. Both agents read/write via simple SQL. No pruning, no optimization.', 0, 'planned'),
('state-store', 'v1', 'Add checkpoints table, escalation records, fast-path completion records. Context rebuilder queries. Pruning policy (keep last N days). Indexes for common query patterns.', 0, 'planned'),
('state-store', 'v2', 'SSE/WebSocket push for live dashboard updates. Postgres option for multi-machine deployments. Full audit trail with retention policies. Query optimization for dashboard views.', 0, 'planned'),

-- User Knowledge Graph
('user-knowledge-graph', 'overview', 'A persistent graph of the user''s world. Nodes are domain entities — people, projects, clients, teams, products, preferences, business rules, conventions, deadlines. Edges are typed relationships with metadata. This is not about code — it''s about understanding who you are and what you care about so agents make contextually appropriate decisions. Entity types: person, project, org, team, preference, convention, deadline, stack, compliance, product, domain-concept, decision. Relationship types: OWNS, PREFERS, WORKS_WITH, HAS_CLIENT, USES_STACK, REQUIRES, CONVENTION, HAS_DEADLINE, DECIDED, DISLIKES. Populated by: (1) User directly — onboarding flow or dashboard edits. (2) Meta-Agent — infers entities from conversations and patterns. (3) Never by Worker — injection safety. Confidence layering: user-explicit (1.0) > meta-agent-inferred (0.8) > auto-extracted (0.6). What it solves: Personalisation ("Alice prefers typed SQL over ORMs"), project awareness ("acme-saas uses Next.js + Postgres, client needs SOC2"), team context ("Bob is backend lead, prefers PRs"), decision memory ("We decided JWT over sessions on Jan 15"), convention enforcement ("No ORMs, minimal comments, Tailwind"), deadline awareness (Meta-Agent prioritises based on known deadlines).', 0, 'planned'),
('user-knowledge-graph', 'mvp', 'SQLite-backed entity store. Add/query entities with typed relationships. Basic traversal (1-hop neighbours). Manual entity creation via CLI or dashboard. Simple text search across entities.', 0, 'planned'),
('user-knowledge-graph', 'v1', 'Meta-Agent write access for inferred entities. Confidence layering (user-explicit 1.0 > meta-inferred 0.8). Multi-hop traversal queries. Convention enforcement lookups. Deadline awareness queries.', 0, 'planned'),
('user-knowledge-graph', 'v2', 'Full graph query language. Temporal awareness (when was this preference set?). Conflict resolution for contradictory preferences. Export/import for portability. Dashboard entity editor.', 0, 'planned'),

-- RPG Code Graph
('rpg-code-graph', 'overview', 'An RPG-style structural graph of the current codebase. Encodes file hierarchy, module boundaries, inter-module data flows, function signatures, class inheritance, and import dependencies. Inspired by Microsoft RPG/ZeroRepo (arxiv.org/abs/2509.16198). This is a code quality feature — it helps the Worker write structurally coherent code. Node types: module, file, function, class, interface, package, route, schema, test. Edge types: CONTAINS, IMPORTS, EXPORTS, DATA_FLOW, EXTENDS, IMPLEMENTS, DEPENDS_ON, TESTS, CALLS. What it solves: Dependency awareness (Worker knows what imports what before editing), placement decisions ("where should rate limiting go?" → traverse module→file→function), topological code generation (build in dependency order), data flow understanding (inter-module edges), pattern consistency (existing patterns visible), blast radius estimation (Meta-Agent traverses deps). Implementation: (1) Initial build on repo load — tree-sitter AST parse, extract files/imports/exports/classes/functions, infer modules from directory structure, ~seconds for repos under 100K LoC. (2) Incremental update on edit — Checkpointer detects file-edit tool calls, re-parses only changed files, diffs old vs new, updates edges incrementally. (3) Query patterns — topo_order(module), data_flow(A,B), dependents(file), pattern(type,dir), where_to_add(capability).', 0, 'planned'),
('rpg-code-graph', 'mvp', 'Static analysis on repo load using tree-sitter. Build initial graph from imports, exports, class hierarchy. Basic queries: list files in module, show imports for file. SQLite-backed.', 0, 'planned'),
('rpg-code-graph', 'v1', 'Incremental updates via Checkpointer (re-parse only changed files). Dependency traversal (topo_order, dependents). Data flow edges between modules. Pattern queries.', 0, 'planned'),
('rpg-code-graph', 'v2', 'Full where_to_add capability suggestions. Blast radius estimation. Meta-Agent annotations. Multi-language AST support. Dashboard Repo Map visualization.', 0, 'planned'),

-- Sanitiser
('sanitiser', 'overview', 'Sits between Worker''s Proxy and downstream servers. Stage 1: Heuristic regex for common injection patterns. Stage 2: Structural strip (remove role tags, cap response length). Stage 3: Optional LLM classifier for sophisticated detection. The Meta-Agent''s proxy does NOT need a sanitiser — its tools are all internal, no external input. Isolated subprocess. Fail-closed. Scans inbound responses (injection defence) and outbound tool args (prevents data exfiltration — e.g. an injected prompt encoding secrets into a search query). Injection events visible in dashboard Security Events panel.', 0, 'planned'),
('sanitiser', 'mvp', 'Regex-based heuristic scanner for common injection patterns. Structural strip (remove role tags, cap response length). Pass/block verdict on each tool response. Logging to State Store.', 0, 'planned'),
('sanitiser', 'v1', 'Outbound scanning (prevent data exfiltration via tool args). Configurable rule sets per tool. Injection frequency tracking. Auto-disable tools exceeding threshold. Dashboard integration.', 0, 'planned'),
('sanitiser', 'v2', 'Optional LLM classifier stage. Adaptive rules based on observed attack patterns. Per-tool confidence scoring. Full audit trail with payload samples.', 0, 'planned'),

-- Live Dashboard
('live-dashboard', 'overview', 'Real-time view of the entire runtime. Read-only — it observes but never mutates. Built as a simple web app (React / plain HTML) that polls the State Store + Supervisor health API. Runs as a separate process managed by the Supervisor. Think: the runtime equivalent of the process tree diagram, but live. Data sources: State Store → goals, tasks, tool call logs, escalations, checkpoints, fast-path records, injection events. Supervisor Health API → process status, uptime, restart count, memory, current model per instance. No direct process inspection — dashboard never connects to OpenCode or proxies directly. Push vs Poll: SSE from State Store for live updates; poll Supervisor health every 5s. Human Gate embedded: approval buttons for gated tasks + escalation responses in same UI.', 0, 'planned'),
('live-dashboard', 'mvp', 'Single-page web app showing process status (up/down) and current goal. Polls Supervisor health API every 5s. Basic goal queue display from State Store. Static HTML + vanilla JS.', 0, 'planned'),
('live-dashboard', 'v1', 'Full process tree view with live status. Goal & task feed with click-to-inspect. Tool call timeline with filtering. Security events panel. Escalation queue with response actions.', 0, 'planned'),
('live-dashboard', 'v2', 'SSE/WebSocket for real-time push updates. Entity Explorer for User KG. Repo Map for Code Graph. Embedded Human Gate approval UI. Performance metrics and resource graphs.', 0, 'planned'),

-- Checkpointer
('checkpointer', 'overview', 'Taps Worker''s Proxy. Writes after every tool response: task ID, tool name, args, result hash, timestamp, plan summary. Also snapshots escalation state so crash recovery can restore a paused-and-waiting Worker correctly. If tool was a file edit, triggers AST re-parse and Code Graph update. Strategy: tool results are facts; LLM reasoning can be re-derived. So we save the facts and let the Context Rebuilder regenerate the reasoning frame on recovery. Runs async — the proxy fires-and-forgets; the Worker never waits for a checkpoint write to complete.', 0, 'planned'),
('checkpointer', 'mvp', 'Intercept tool responses from Worker proxy. Write task_id, tool_name, args_hash, result_hash, timestamp to State Store. Fire-and-forget (async, non-blocking).', 0, 'planned'),
('checkpointer', 'v1', 'Escalation state snapshots. File-edit detection triggering Code Graph AST re-parse. Plan summary snapshots for context rebuilder. Idempotency markers for crash recovery.', 0, 'planned'),
('checkpointer', 'v2', 'Configurable checkpoint granularity. Compressed checkpoint storage. Checkpoint pruning with retention policy. Metrics on checkpoint write latency.', 0, 'planned'),

-- Context Rebuilder
('context-rebuilder', 'overview', 'On crash recovery of either instance: generates resume prompt from compressed checkpoint + relevant graph context. For Worker: "you were doing X, completed Y, next step Z". For Meta-Agent: "current goal is X, worker status is Y, pending goals are Z". If Worker was in paused:awaiting_guidance state, resume prompt includes the escalation question and any response received while it was down. Lossy by design. You can''t clone LLM hidden state — it''s non-serialisable. This is like a save game, not a VM snapshot.', 0, 'planned'),
('context-rebuilder', 'mvp', 'Read last checkpoint from State Store. Generate basic resume prompt: "you were doing X, completed Y, next step Z". Inject as system prompt on respawn.', 0, 'planned'),
('context-rebuilder', 'v1', 'Include relevant User KG context in resume prompt. Include Code Graph context for coding tasks. Handle paused:awaiting_guidance state.', 0, 'planned'),
('context-rebuilder', 'v2', 'Compressed multi-checkpoint summaries. Relevance-ranked context selection. Token budget management for resume prompts.', 0, 'planned'),

-- Human Gate
('human-gate', 'overview', 'Three modes: full-auto, approve-goals, approve-all. Plus write fence: dangerous ops require approval even in full-auto. Also surfaces escalation requests from the Worker. Write fence per-instance: Meta-Agent config mutations and Worker destructive ops have independent gate policies. Gate mode is a runtime flag — switch between modes without restarting.', 0, 'planned'),
('human-gate', 'mvp', 'Basic approval queue. CLI-based approve/reject. Write fence for destructive operations (hardcoded list). Block until approved or timeout.', 0, 'planned'),
('human-gate', 'v1', 'Runtime mode switching (full-auto, approve-goals, approve-all). Per-instance gate policies. Escalation forwarding from Meta-Agent. Dashboard-embeddable approval UI.', 0, 'planned'),
('human-gate', 'v2', 'Configurable write fence per tool category. Approval delegation rules. Audit trail of all gate decisions. Timeout policies with configurable fallback actions.', 0, 'planned'),

-- MCP Proxies
('mcp-proxy-meta', 'overview', 'Hosts 10 planning tools (6 planning + 4 graph). These are your custom MCP servers — small, stable, purpose-built. No external API calls, no injection risk.', 0, 'planned'),
('mcp-proxy-meta', 'mvp', 'Static MCP server hosting goal_queue, state_reader, worker_control tools. Simple stdio transport. No hot-swap needed.', 0, 'planned'),
('mcp-proxy-worker', 'overview', 'Hosts all external-facing tools + escalation + graph reads. Dynamic manifest — Meta-Agent''s proxy_admin adds/removes servers at runtime. All responses pass through Sanitiser. Health & circuit breaker: heartbeats downstream servers; dead endpoints auto-removed from manifest, Meta-Agent notified via State Store so it can find replacements.', 0, 'planned'),
('mcp-proxy-worker', 'mvp', 'MCP proxy with configurable tool list. Route tool calls to downstream servers. Pass responses through sanitiser. Basic health check on downstream servers.', 0, 'planned'),

-- Fast Path Router
('fast-path-router', 'overview', 'Rule engine (no LLM). Classifies tasks as fast, full, or gated. Scores by complexity signals: single-step, no ambiguity, no tool mutation needed. Configurable: fast_path: "aggressive" | "conservative" | "off". Can query User KG for context. Cuts latency and cost ~50% for simple tasks. Fallback: failed fast-path tasks re-route through Meta-Agent.', 0, 'planned'),
('fast-path-router', 'mvp', 'Simple rule engine: match task text against patterns (single verb, no conditionals, target file exists). Three outputs: fast, full, gated. Configurable threshold.', 0, 'planned'),

-- Dual Heartbeat
('dual-heartbeat', 'overview', 'Monitors both OpenCode instances independently via waitpid() + liveness probes. Instant crash detection (zero latency) — waitpid() returns the moment a child exits. Periodic liveness probe for hang detection — if no output for timeout_ms, treat as hung. Detects: exit, hang, OOM. If Worker crashes → recover using Meta-Agent''s last plan. If Meta-Agent crashes → recover it first (higher priority), then it re-dispatches Worker. Exponential backoff, max 5 retries → alert Human Gate.', 0, 'planned'),
('dual-heartbeat', 'mvp', 'waitpid() loop for crash detection. Basic restart on exit. Retry counter with max limit. Log crash events.', 0, 'planned'),

-- Alert Pipeline
('alert-pipeline', 'overview', 'Blocked injections logged to State Store. Meta-Agent can auto-disable compromised tools via injection feedback loop — reads sanitiser alerts and learns to avoid them. Dashboard shows real-time security events.', 0, 'planned'),

-- Dashboard sub-components
('live-process-view', 'overview', 'Process tree with real-time status: running, recovering, crashed, paused for every child. Uptime, restart count, current model, memory usage per instance.', 0, 'planned'),
('goal-task-feed', 'overview', 'Live stream of the Goal Queue. Current goal, decomposed sub-tasks, completion status. See what the Meta-Agent is planning and what the Worker is executing. Clickable to inspect full task payloads.', 0, 'planned'),
('tool-call-timeline', 'overview', 'Chronological feed of every tool call (both instances). Shows: tool name, args (truncated), response status, latency, sanitiser verdict (pass/block). Filterable by instance, tool, and status. This is your debugging lifeline.', 0, 'planned'),
('security-events', 'overview', 'Sanitiser verdicts, blocked injections with raw payload preview, injection frequency per tool, auto-disable events. Links to full audit log entries. Alerts when injection rate exceeds threshold.', 0, 'planned'),
('escalation-queue', 'overview', 'Worker escalation requests waiting for Meta-Agent or human review. Shows the Worker''s question, context snapshot, and available actions: respond, override, or abort task.', 0, 'planned'),
('entity-explorer', 'overview', 'Browse the User Knowledge Graph. See people, projects, preferences, and their relationships. Understand what the agents "know about you".', 0, 'planned'),
('repo-map', 'overview', 'Visualise the Code Graph. Module hierarchy, file deps, data flows. See the agent''s structural understanding of your codebase.', 0, 'planned'),
('human-gate-dashboard', 'overview', 'Approval queue + escalation responses. Gate actions embeddable in dashboard UI.', 0, 'planned'),

-- Tools
('goal-queue', 'overview', 'push, pop, peek, reprioritise — manages the persistent goal queue.', 0, 'planned'),
('state-reader', 'overview', 'get_checkpoint, get_task_log, get_escalations — reads Worker''s progress.', 0, 'planned'),
('worker-control', 'overview', 'dispatch, abort, respond_escalation — sends phase-locked work to Worker. Dispatch includes phase, forbidden_actions, success_criteria.', 0, 'planned'),
('proxy-admin', 'overview', 'register, deregister, list — mutates Worker''s tool manifest at runtime.', 0, 'planned'),
('config-mutator', 'overview', 'update_prompt, update_model, update_agents — evolves Worker''s config via typed builder DSL. Validated, versioned, rollback-safe.', 0, 'planned'),
('tool-registry', 'overview', 'search, inspect, install — discovers new MCP servers from a catalogue.', 0, 'planned'),
('user-kg-read-meta', 'overview', 'query, traverse, search — Meta-Agent reads User KG for planning context.', 0, 'planned'),
('user-kg-write-meta', 'overview', 'add_entity, add_edge, annotate — Meta-Agent writes inferred entities to User KG.', 0, 'planned'),
('code-graph-read-meta', 'overview', 'expand, path, topo_order — Meta-Agent reads Code Graph for repo-aware decomposition.', 0, 'planned'),
('code-graph-write-meta', 'overview', 'annotate_module, set_data_flow — Meta-Agent annotates Code Graph with module boundaries and data flow intentions.', 0, 'planned'),
('request-clarification', 'overview', 'Writes question + context snapshot to State Store. Sets task status to paused:awaiting_guidance. Worker halts current execution and waits.', 0, 'planned'),
('check-escalation-response', 'overview', 'Polls State Store for Meta-Agent''s response. Returns guidance or still_pending. Worker resumes when guidance arrives.', 0, 'planned'),
('user-kg-read-worker', 'overview', 'Read-only. No writes (injection safety). Worker reads preferences but cannot poison the knowledge graph.', 0, 'planned'),
('code-graph-read-worker', 'overview', 'Read-only. Checkpointer writes on Worker''s behalf after file edits trigger AST re-parse.', 0, 'planned'),

-- Downstream tools
('tool-search', 'overview', 'External search MCP server.', 0, 'planned'),
('tool-email', 'overview', 'External email MCP server.', 0, 'planned'),
('tool-database', 'overview', 'External database MCP server.', 0, 'planned'),
('tool-filesystem', 'overview', 'External filesystem MCP server.', 0, 'planned'),
('tool-code-exec', 'overview', 'External code execution MCP server.', 0, 'planned'),
('tool-custom', 'overview', 'Custom MCP servers — hot-swappable, added/removed by Meta-Agent at runtime.', 0, 'planned'),

-- Task Router paths
('fast-path', 'overview', 'Rule engine says: single-step, unambiguous, existing tools suffice. Task goes directly to Worker. Meta-Agent notified post-completion via State Store. Flow: task → classifier → FAST → Worker → done → State Store → Meta-Agent reads.', 0, 'planned'),
('full-path', 'overview', 'Classifier says: multi-step, ambiguous, or needs tool changes. Task goes to Meta-Agent for decomposition. Normal planning loop. Flow: task → classifier → FULL → Meta-Agent → plan → dispatch → Worker → State Store.', 0, 'planned'),
('gated-path', 'overview', 'Classifier or Human Gate flags: destructive, high-cost, or security-sensitive. Task pauses for human approval. Flow: task → classifier → GATE → Human Gate → approve → (fast or full path).', 0, 'planned'),

-- BDD/TDD phases
('phase-feature', 'overview', 'Write the .feature file. Describe the behaviour in Gherkin. DO NOT write any tests or code. Gate: .feature file exists. Git commit after phase.', 0, 'planned'),
('phase-steps', 'overview', 'Write failing step definitions for this feature file. DO NOT implement any production code. Gate: step files exist. Git commit after phase.', 0, 'planned'),
('phase-units', 'overview', 'Write failing unit tests for the components you''ll need. DO NOT implement any production code. Gate: test files exist. Git commit after phase.', 0, 'planned'),
('phase-red', 'overview', 'Run all tests. Confirm they fail. Report which tests fail and why. DO NOT fix anything. Gate: tests fail. Git commit after phase.', 0, 'planned'),
('phase-green', 'overview', 'Write the minimum production code to make all tests pass. DO NOT refactor or optimise. Gate: tests pass. Git commit after phase.', 0, 'planned'),
('phase-refactor', 'overview', 'Refactor for clarity, DRY, naming. All tests must still pass. DO NOT add new functionality. Gate: tests still pass. Git commit after phase.', 0, 'planned'),
('phase-arch-review', 'overview', 'LLM-driven audit agent. Audit against Clean Architecture: dependency direction (inner layers importing outer = violation), layer boundaries (business logic in controllers), abstraction leaks (SQL in repository interface), use case isolation. Traverses Code Graph DATA_FLOW and IMPORTS edges structurally. DO NOT fix — only report. Report: {violations: [{file, line, rule, severity, explanation}], passed: bool}. Gate: 0 violations. Git commit after phase.', 0, 'planned'),
('phase-sec-review', 'overview', 'LLM-driven security audit. Injection vectors (SQL, XSS, command injection, path traversal), auth/authz gaps (missing middleware, privilege escalation), secrets exposure (hardcoded keys, tokens in logs, .env leaks), unsafe dependencies (CVEs, deprecated crypto). Checks User KG compliance requirements (e.g. SOC2). DO NOT fix — only report. Same report format. Gate: 0 findings. Git commit after phase.', 0, 'planned'),

-- Roadmap (self-tracking)
('roadmap', 'overview', 'Living documentation for the Open Autonomous Runtime. Self-tracking component with progression tree UI, versioned specs, Gherkin feature files, and BDD/TDD pipeline. Built with Clean Architecture (TypeScript), SQLite graph database, and Cytoscape.js for the progression tree visualization.', 0, 'in-progress'),
('roadmap', 'mvp', 'Clean Architecture TypeScript codebase. SQLite graph database with 4 tables (nodes, edges, node_versions, features). BDD test suite (Cucumber + Vitest). CI merge gate. Static web view with architecture diagram. Progression tree home page with Cytoscape.js. Self-tracking as a component.', 0, 'in-progress');
