---
description: Implement a feature using the full BDD red-to-green TDD workflow
agent: build
---

Implement the following feature using the BDD red-to-green TDD workflow described below.

**Feature request**: $ARGUMENTS

---

## Workflow

You MUST follow these phases in strict order. Use the TodoWrite tool to create and track a todo list with ALL phases before starting any work. Mark each phase as `in_progress` when you start it and `completed` when you finish it. Do NOT skip phases or combine them.

### Commit Strategy

After completing each phase (1-7), commit progress using `git commit --no-verify` to skip the pre-commit hook. This saves your work without running the full pipeline at every step.

**Commit message format**: `wip(<scope>): phase <N> — <description>`

Examples:
- `wip(web): phase 1 — feature file for click dialog`
- `wip(web): phase 3 — unit tests for click dialog`
- `wip(web): phase 5 — implementation (GREEN)`
- `wip(web): phase 7 — refactor cleanup`

The scope should match the area of work (e.g., `web`, `domain`, `use-cases`, `infrastructure`, `cli`).

Phase 8 is the only phase that runs the full pre-commit pipeline via a normal `git commit` (with hooks). This final commit replaces the `wip` prefix with the proper conventional commit type (e.g., `feat`, `fix`, `refactor`).

### Phase 1: Feature File (Gherkin)

- Create a `.feature` file in `features/` with Gherkin scenarios covering the feature
- Write scenarios in business language using Given/When/Then
- Also create a copy in the appropriate `components/*/features/` directory following the naming convention (`mvp-*.feature`, `v1-*.feature`, or `v2-*.feature`)
- Aim for thorough coverage: happy paths, edge cases, error cases

**Checkpoint**: Run `npm run test:features -- --dry-run` to verify the feature file parses correctly.

**Commit**: `git add -A && git commit --no-verify -m "wip(<scope>): phase 1 — feature file for <feature>"`

### Phase 2: Step Definitions

- Create step definitions in `tests/step-definitions/` that match ALL steps from the feature file
- Each step should have meaningful assertions (not just pass-through)
- Import `expect` from `vitest` for assertions

**Checkpoint**: Run `npm run test:features` and confirm all new scenarios are recognized (they should FAIL because the implementation doesn't exist yet).

**Commit**: `git add -A && git commit --no-verify -m "wip(<scope>): phase 2 — step definitions for <feature>"`

### Phase 3: Unit Tests

- Create unit tests in `tests/unit/` covering the implementation you're about to write
- Organize into describe blocks by concern (structure, behavior, content, etc.)
- Test at the appropriate layer: domain entities, use cases, infrastructure, or web view
- Follow existing test patterns in the codebase

**Checkpoint**: Run `npm run test:unit` and confirm the new tests FAIL (RED).

**Commit**: `git add -A && git commit --no-verify -m "wip(<scope>): phase 3 — unit tests for <feature>"`

### Phase 4: RED Verification

- Run `npm run test:unit` — confirm new tests FAIL
- Run `npm run test:features` — confirm new BDD scenarios FAIL
- Document the failure counts (e.g., "16/16 unit tests failed, 10/10 BDD scenarios failed")
- This verifies the tests are actually testing something real

**STOP if tests pass at this point** — it means the tests are not properly written or the feature already exists.

No commit for this phase — it's a verification step only.

### Phase 5: Implementation (GREEN)

- Write the minimal code to make ALL tests pass
- Follow Clean Architecture: Domain -> Use Cases -> Infrastructure -> Adapters
- Respect dependency rules: inner layers know nothing about outer layers
- Use barrel imports (import from `index.ts`, not deep paths)
- Follow existing code patterns and conventions in the codebase
- Constructor injection for use cases, adapters wire dependencies

**Checkpoint**: Run `npm run test:unit && npm run test:features` — ALL tests must pass (GREEN).

**Commit**: `git add -A && git commit --no-verify -m "wip(<scope>): phase 5 — implementation for <feature>"`

### Phase 6: GREEN Verification

- Run `npm run test:unit` — confirm ALL tests pass (including pre-existing ones)
- Run `npm run test:features` — confirm ALL scenarios pass
- Document the pass counts (e.g., "159/159 unit tests pass, 110/110 BDD scenarios pass")

**STOP if any pre-existing tests broke** — fix regressions before proceeding.

No commit for this phase — it's a verification step only.

### Phase 7: Refactor

- Clean up the implementation while keeping all tests green
- Remove duplication, improve naming, extract common patterns
- Remove any dead code, unused imports, or leftover scaffolding
- Run `npm run test:unit && npm run test:features` after each refactor step

**Commit** (if changes were made): `git add -A && git commit --no-verify -m "wip(<scope>): phase 7 — refactor <feature>"`

### Phase 8: Pre-Commit Verification

- Run the full pre-commit pipeline: `npm run pre-commit`
- This runs all 7 stages: code quality (12 checks), lint, format, typecheck, build, coverage (90% thresholds), BDD features
- Fix any issues that arise and re-run until clean
- Once clean, create the final commit WITH hooks (no `--no-verify`):
  `git add -A && git commit -m "feat(<scope>): <feature description>"`
- This final commit runs the full pre-commit pipeline and serves as the quality gate
- Do NOT proceed to shipping until this passes

---

## Todo List Structure

Create exactly this todo list at the start:

1. "Phase 1: Write feature file + commit" — priority: high
2. "Phase 2: Write step definitions + commit" — priority: high
3. "Phase 3: Write unit tests + commit" — priority: high
4. "Phase 4: RED verification (all new tests must fail)" — priority: high
5. "Phase 5: Implementation + commit" — priority: high
6. "Phase 6: GREEN verification (all tests must pass)" — priority: high
7. "Phase 7: Refactor + commit" — priority: medium
8. "Phase 8: Pre-commit verification + final commit" — priority: high

---

## Rules

- NEVER write implementation code before the tests exist and are verified RED
- NEVER skip the RED verification — it proves the tests work
- NEVER skip the GREEN verification — it proves nothing else broke
- NEVER skip pre-commit — it's the final quality gate
- Use `--no-verify` for phase 1-7 commits to skip hooks (saves time, work is in progress)
- Phase 8 is the ONLY commit that runs with full hooks — it is the quality gate
- If pre-commit fails at Phase 8, fix issues and re-run (do not consider the phase done until it passes)
- After Phase 8 passes, report completion and ask the user if they want to `/ship`
