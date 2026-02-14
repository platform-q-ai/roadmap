---
description: BDD red-to-green TDD workflow
agent: build
---
Implement using strict BDD red-to-green. Feature: $ARGUMENTS

Track all 8 phases via TodoWrite. Phases 1-7 commit with `git commit --no-verify -m "wip(<scope>): phase <N> — <desc>"`. Phase 8 is the only normal commit (with hooks).

**Phase 1: Feature file** — Write `.feature` in `features/` + copy in `components/*/features/` (`mvp-`/`v1-`/`v2-` prefix). Checkpoint: `npm run test:features -- --dry-run`. Commit.

**Phase 2: Step definitions** — Create in `tests/step-definitions/`. Use `expect` from vitest. Checkpoint: `npm run test:features` — scenarios must FAIL. Commit.

**Phase 3: Unit tests** — Create in `tests/unit/`. Checkpoint: `npm run test:unit` — must FAIL (RED). Commit.

**Phase 4: RED verification** — Run unit + feature tests. All new tests must fail. Stop if they pass (tests are wrong). No commit.

**Phase 5: Implementation (GREEN)** — Minimal code to pass all tests. Clean Architecture order: Domain→Use Cases→Infrastructure→Adapters. Barrel imports, constructor injection. Checkpoint: `npm run test:unit && npm run test:features` — ALL pass. Commit.

**Phase 6: GREEN verification** — Confirm all tests pass including pre-existing. Stop if regressions. If the feature touches `web/` or UI: start the server (`npm run serve`), use Playwright MCP to open `http://localhost:8080`, take a screenshot, and verify the change visually. No commit.

**Phase 7: Refactor** — Clean up, remove duplication, keep tests green. Commit if changes made.

**Phase 8: Pre-commit** — `npm run pre-commit` (all 7 gates). Fix until clean. Final commit: `git commit -m "feat(<scope>): <desc>"` (with hooks). Report completion, ask user if they want to `/ship`.

Rules: NEVER write implementation before RED tests exist. NEVER skip RED/GREEN verification. NEVER skip pre-commit. `--no-verify` for phases 1-7 only.
