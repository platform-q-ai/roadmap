# coding-agent-spawner-mcp

## Overview

An MCP server that provides the Coding Sub-Agent with structured, BDD-enforced tools for spawning and managing Worker agents. Forked from `worker-spawner-mcp`, it replaces free-form prompting with a strict pipeline state machine. All coding work — greenfield, bug fixes, and changes — flows through the same BDD sequence. The Sub-Agent writes freehand prompts, but is forced to write them through pipeline stages. No way to bypass the process.

The Coding Sub-Agent is the only agent with access to this MCP server. The Meta-Agent dispatches coding goals to the Coding Sub-Agent. The Sub-Agent decomposes goals, spawns workers, and drives them through BDD pipelines.

## Pipeline

Every coding task follows this sequence. Commits and quality checks are interleaved between each BDD stage so that every meaningful change is captured atomically and validated before proceeding.

```
 1. accept_goal
 2. instruct_feature_file
 3. commit                    ← commit the feature file(s)
 4. run_quality_checks        ← lint, gherkin syntax validation
 5. instruct_step_defs
 6. commit                    ← commit step definitions
 7. run_quality_checks        ← lint, type-check stubs
 8. instruct_unit_tests
 9. commit                    ← commit the red tests
10. run_quality_checks        ← lint, test syntax validation
11. instruct_implementation
12. commit                    ← commit the green implementation
13. run_quality_checks        ← lint, type-check, tests pass, coverage
14. instruct_refactor
15. commit                    ← commit the refactored code
16. run_quality_checks        ← full suite: lint, type-check, tests, coverage
17. run_validation            ← integration/acceptance checks
18. commit                    ← commit any validation fixes or config
19. mark_complete
```

### Stage Definitions

| Stage | Purpose | What the Sub-Agent Sends |
|-------|---------|--------------------------|
| `accept_goal` | Register a task, link it to a worker, record the goal and workflow type | Goal text, type (greenfield/bugfix/change), worker name |
| `instruct_feature_file` | Tell the Worker to write or modify Gherkin feature files | Freehand prompt describing what scenarios to write |
| `instruct_step_defs` | Tell the Worker to write step definition stubs | Freehand prompt with guidance on step implementation approach |
| `instruct_unit_tests` | Tell the Worker to write unit tests (expect red) | Freehand prompt specifying test scope and expectations |
| `instruct_implementation` | Tell the Worker to write code that makes tests pass (green) | Freehand prompt with implementation guidance |
| `instruct_refactor` | Tell the Worker to clean up the implementation | Freehand prompt with refactoring priorities |
| `run_validation` | Tell the Worker to run integration/acceptance checks | Freehand prompt specifying what to validate |
| `commit` | Tell the Worker to commit the current changes | Commit message (or instructions to generate one) |
| `run_quality_checks` | Tell the Worker to run quality tooling | Specific checks to run (or "all") |
| `mark_complete` | Close the pipeline, record final state | Completion summary |

### Commit Stages

Every `commit` stage is context-aware. The enforcer knows which BDD stage preceded it, so:

- After `instruct_feature_file` → commit message should reference the feature spec
- After `instruct_step_defs` → commit message should reference step definitions
- After `instruct_unit_tests` → commit message should reference the red tests
- After `instruct_implementation` → commit message should reference the green implementation
- After `instruct_refactor` → commit message should reference the refactoring
- After `run_validation` → commit message should reference validation fixes (if any changes were made)

If `commit` is called after `run_validation` and there are no changes to commit, the enforcer accepts a no-op commit (records the stage transition with a note that no changes were present) and allows progression to `mark_complete`.

### Quality Check Stages

Each `run_quality_checks` stage runs checks appropriate to what was just committed:

| After Stage | Checks Run |
|-------------|------------|
| `instruct_feature_file` + `commit` | Gherkin syntax validation, lint |
| `instruct_step_defs` + `commit` | Lint, type-check (stubs may have type errors — recorded but non-blocking) |
| `instruct_unit_tests` + `commit` | Lint, test syntax validation, tests run (expect failures — recorded as expected) |
| `instruct_implementation` + `commit` | Lint, type-check, all tests pass, coverage report |
| `instruct_refactor` + `commit` | Full suite: lint, type-check, all tests pass, coverage >= pre-refactor |

Quality check results are recorded in the transition history. Failures after `instruct_implementation` or `instruct_refactor` block progression — the Sub-Agent must fix and re-commit before proceeding.

### Sequence Enforcement

**Forward only, one step at a time.** The enforcer rejects any attempt to skip stages.

**Allowed back-transitions:**

| From | Back To | Reason |
|------|---------|--------|
| `instruct_implementation` | `instruct_unit_tests` | Red-green cycle — tests need adjustment |
| `run_quality_checks` (post-impl) | `instruct_implementation` | Quality checks failed, need code fixes |
| `run_quality_checks` (post-refactor) | `instruct_refactor` | Refactoring broke something |
| `run_validation` | `instruct_feature_file` | Spec was wrong, start over |
| `run_validation` | `instruct_unit_tests` | Edge case discovered, add tests |

When going back, the pipeline resumes the full sequence from that point. Going back to `instruct_feature_file` means you go through every subsequent stage again including all commits and quality checks.

**Never allowed:**
- Skipping forward (e.g., `accept_goal` → `instruct_implementation`)
- Calling `mark_complete` from any stage other than `commit` (post-validation) or `run_validation`

### Rejection Response

When a stage is called out of sequence:

```json
{
  "error": "sequence_violation",
  "task_id": "abc-123",
  "current_stage": "instruct_feature_file",
  "attempted_stage": "instruct_unit_tests",
  "allowed_next": ["commit"],
  "message": "Cannot instruct unit tests. You must commit the feature file first. Call commit next.",
  "transition_history": [
    { "stage": "accept_goal", "at": "2026-02-10T10:00:00Z" },
    { "stage": "instruct_feature_file", "at": "2026-02-10T10:02:00Z" }
  ]
}
```

## Tools

### Pipeline Tools

#### `accept_goal`

Register a new coding task and link it to a worker.

```
Input:
  goal: string          — What needs to be done
  type: enum            — "greenfield" | "bugfix" | "change"
  worker: string        — Worker name or session ID

Output:
  task_id: string       — Generated task ID
  stage: "accept_goal"
  next: "instruct_feature_file"
  hint: string          — Contextual guidance based on workflow type
```

**Hints by type:**

- **greenfield**: "Write feature files that describe the desired behavior from scratch. Think about happy paths, edge cases, and error scenarios."
- **bugfix**: "Write or modify a scenario that exposes the bug — describing correct behavior the system should exhibit but currently doesn't. This failing scenario becomes your regression test."
- **change**: "Update or add scenarios to reflect the new expected behavior. Modify existing scenarios where business rules have changed. Watch them fail, then update the implementation."

#### `instruct_feature_file`

Dispatch a feature file writing prompt to the Worker.

```
Input:
  task_id: string       — Active task ID
  prompt: string        — Freehand instruction to the Worker

Output:
  stage: "instruct_feature_file"
  next: "commit"
  dispatched: true
  worker_session: string
```

#### `instruct_step_defs`

Dispatch a step definition writing prompt to the Worker.

```
Input:
  task_id: string
  prompt: string

Output:
  stage: "instruct_step_defs"
  next: "commit"
  dispatched: true
```

#### `instruct_unit_tests`

Dispatch a unit test writing prompt to the Worker.

```
Input:
  task_id: string
  prompt: string

Output:
  stage: "instruct_unit_tests"
  next: "commit"
  dispatched: true
```

#### `instruct_implementation`

Dispatch an implementation prompt to the Worker.

```
Input:
  task_id: string
  prompt: string

Output:
  stage: "instruct_implementation"
  next: "commit"
  dispatched: true
```

#### `instruct_refactor`

Dispatch a refactoring prompt to the Worker.

```
Input:
  task_id: string
  prompt: string

Output:
  stage: "instruct_refactor"
  next: "commit"
  dispatched: true
```

#### `run_validation`

Dispatch a validation prompt to the Worker.

```
Input:
  task_id: string
  prompt: string

Output:
  stage: "run_validation"
  next: "commit"
  dispatched: true
  hint: "If validation passes with no changes, the next commit can be a no-op."
```

#### `commit`

Instruct the Worker to commit the current changes.

```
Input:
  task_id: string
  message: string       — Commit message or instruction to generate one

Output:
  stage: "commit"
  context: string       — Which BDD stage this commit follows (e.g., "post_feature_file")
  next: string          — Next stage in the pipeline (e.g., "run_quality_checks")
  dispatched: true
```

#### `run_quality_checks`

Instruct the Worker to run quality checks appropriate to the current pipeline position.

```
Input:
  task_id: string
  checks: string[]      — Optional override; defaults to checks appropriate for current position

Output:
  stage: "run_quality_checks"
  context: string       — Which BDD stage these checks follow
  next: string          — Next stage if checks pass
  dispatched: true
```

#### `mark_complete`

Close the task pipeline.

```
Input:
  task_id: string
  summary: string       — Completion summary

Output:
  stage: "mark_complete"
  task_id: string
  total_transitions: int
  total_commits: int
  duration: string
  status: "complete"
```

### Worker Lifecycle Tools

Retained from worker-spawner-mcp with no changes to behavior.

#### `spawn_worker`

Spawn a new isolated Worker agent with a scaffolded repo and OpenCode session.

```
Input:
  name: string          — Worker identifier (kebab-case)
  template: enum        — "api" | "frontend" | "cli" | "library" | "mcp"
  model: string?        — LLM model ID (default: anthropic/claude-sonnet-4-20250514)

Output:
  worker: string
  session_id: string
  repo_path: string
  port: number
  status: "running"
```

Note: The initial prompt is NOT sent at spawn time (unlike worker-spawner-mcp). The first prompt comes via `accept_goal` → `instruct_feature_file`. The Worker starts idle, waiting for pipeline instructions.

#### `list_workers`

List all workers with name, session ID, repo path, status, and any active task IDs.

#### `stop_worker`

Stop a worker's OpenCode server process.

#### `remove_worker`

Remove a worker completely. Stop server, remove from registry, optionally delete repo.

```
Input:
  worker: string
  delete_repo: boolean? — Default false
```

#### `health_check`

Check health of all workers. Optionally restart crashed servers.

```
Input:
  fix: boolean?         — Default false
```

#### `set_worker_model`

Change the LLM model for a worker.

```
Input:
  worker: string
  model: string
```

### Worker Inspection Tools

Retained from worker-spawner-mcp. Read-only access to worker repos and OpenCode sessions.

#### `check_worker_status`

Get worker status including busy state, last message preview, and file change stats.

```
Input:
  worker: string

Output:
  status: string
  busy: boolean
  last_message: string      — Truncated preview
  files_changed: int
  additions: int
  deletions: int
  active_task: object?      — Current pipeline task info if any
```

#### `read_worker_file`

Read a file from the worker's repo. Path-traversal protected.

```
Input:
  worker: string
  file_path: string     — Relative to worker repo root
```

#### `glob_worker`

Find files by glob pattern in worker repo.

```
Input:
  worker: string
  pattern: string       — Glob pattern (e.g., "src/**/*.ts")
```

#### `grep_worker`

Search file contents in worker repo.

```
Input:
  worker: string
  pattern: string       — Regex pattern
  file_pattern: string  — File glob filter (e.g., "*.ts")
```

## State Management

### SQLite Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('greenfield', 'bugfix', 'change')),
  worker_name TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'failed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  prompt TEXT,
  commit_sha TEXT,
  quality_results TEXT,          -- JSON: check results for run_quality_checks stages
  worker_response_summary TEXT,  -- Optional: filled by check_worker_status
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE workers (
  name TEXT PRIMARY KEY,
  session_id TEXT,
  repo_path TEXT NOT NULL,
  model TEXT NOT NULL,
  server_port INTEGER NOT NULL,
  server_pid INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'idle', 'stopped', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Database Location

`~/.coding-agent-spawner/state.db`

Workers are tracked in SQLite (replacing the JSON registry from worker-spawner-mcp). This gives us transactional state transitions — a stage validation and state update happen in a single transaction, preventing race conditions.

### Allowed Transitions Matrix

The enforcer maintains an adjacency list defining valid transitions:

```
accept_goal              → [instruct_feature_file]
instruct_feature_file    → [commit]
commit (post-feature)    → [run_quality_checks]
run_quality_checks (post-feature) → [instruct_step_defs]
instruct_step_defs       → [commit]
commit (post-steps)      → [run_quality_checks]
run_quality_checks (post-steps) → [instruct_unit_tests]
instruct_unit_tests      → [commit]
commit (post-tests)      → [run_quality_checks]
run_quality_checks (post-tests) → [instruct_implementation]
instruct_implementation  → [commit]
commit (post-impl)       → [run_quality_checks]
run_quality_checks (post-impl) → [instruct_refactor, instruct_implementation]
instruct_refactor        → [commit]
commit (post-refactor)   → [run_quality_checks]
run_quality_checks (post-refactor) → [run_validation, instruct_refactor]
run_validation           → [commit, instruct_feature_file, instruct_unit_tests]
commit (post-validation) → [mark_complete]
mark_complete            → []
```

Note: `commit` and `run_quality_checks` are context-sensitive — their allowed transitions depend on which BDD stage preceded them. The enforcer tracks this via the `from_stage` on the transition record.

## Architecture Placement

```
Meta-Agent
    │
    │  DISPATCHES_TO
    ▼
Coding Sub-Agent (OpenCode instance, specialized system prompt)
    │
    │  uses (MCP stdio)
    ▼
coding-agent-spawner-mcp
    │
    │  HTTP REST (per worker)
    ▼
Worker(s) (OpenCode instances, isolated repos)
```

The Coding Sub-Agent is an OpenCode instance with:
- System prompt focused on BDD methodology and task decomposition
- `coding-agent-spawner-mcp` as its primary MCP server
- No direct codebase access — it only operates through workers

## Tech Stack

- **Language**: TypeScript (ESM, strict mode)
- **Runtime**: Node.js >= 18
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Schema validation**: `zod`
- **Database**: `better-sqlite3`
- **File matching**: `glob`
- **Transport**: stdio (MCP standard)

## Design Decisions

1. **Single MCP server, not two.** BDD enforcement and worker management are in one server because all prompting must go through the pipeline. Splitting them would leave a gap where the Sub-Agent could bypass enforcement via a separate spawner.

2. **Commits between every BDD stage.** Atomic commits per stage give you: git bisect capability per-stage, rollback to any BDD checkpoint, and a commit history that reads like a development narrative.

3. **Quality checks between every BDD stage.** Catches issues early. Lint errors in a feature file are cheaper to fix before writing step definitions. Type errors in stubs are cheaper to fix before writing tests.

4. **Context-sensitive commit and quality stages.** `commit` and `run_quality_checks` aren't standalone — they know what BDD stage preceded them. This allows appropriate commit messages and check suites without the Sub-Agent having to specify.

5. **No initial prompt on spawn.** Unlike worker-spawner-mcp, `spawn_worker` doesn't send a task prompt. The worker starts idle. First instructions come through the pipeline via `instruct_feature_file`. This prevents any work happening outside the BDD process.

6. **SQLite replaces JSON registry.** Transactional state transitions prevent race conditions. Pipeline validation and state update are atomic.

7. **Freehand prompts, structured process.** The Sub-Agent has full creative control over what it tells the Worker to do. The enforcer only controls the order. This preserves the LLM's ability to reason about implementation while ensuring methodological discipline.
