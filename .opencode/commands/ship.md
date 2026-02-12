---
description: Commit, push, create PR, and trigger architecture, security, performance, and documentation reviews
agent: build
---

Complete the shipping workflow for the current branch:

1. **Pre-flight checks** — Run the full pre-commit pipeline (`npm run pre-commit`). Stop if anything fails.

2. **Commit** — If there are uncommitted changes, stage them and create a conventional commit. Analyze the diff to write an accurate commit message. If there are no changes, skip to step 3.

3. **Push** — Push the current branch to origin with `-u` to set upstream tracking.

4. **Create PR** — Use `gh pr create` to open a pull request against `master`. The PR title should match the commit message. The body should include a `## Summary` section with 2-4 bullet points describing the changes. If a PR already exists for this branch, skip creation.

5. **Architecture Review** — Invoke the `@architecture-reviewer` subagent with the PR number. It reviews Clean Architecture boundaries, code quality rules, barrel exports, constructor injection, and conventional commits.

6. **Security Review** — Invoke the `@security-reviewer` subagent with the PR number. It reviews for injection vectors, auth/authz gaps, secrets exposure, unsafe crypto, and input validation.

7. **Performance Review** — Invoke the `@performance-reviewer` subagent with the PR number. It reviews for algorithmic inefficiency, N+1 queries, memory leaks, missing caching, and blocking I/O.

8. **Address feedback** — Read ALL comments left by ALL three reviewers. For each one:
   - Make the required code change.
   - Run `npm run lint && npm run test:unit` to verify the fix.
   - Commit the fix with a message like `fix(<scope>): address review — <what was fixed>`.
   - Resolve the comment on GitHub using `gh api graphql` with the `resolveReviewThread` mutation.

9. **Push fixes** — Push all fix commits to the PR branch.

10. **Documentation Update** — Invoke the `@documentation-updater` subagent with the PR number. It reads the diff and updates `README.md` and/or `AGENTS.md` if the PR introduced new endpoints, agents, commands, configuration, or other documentation-relevant changes. If it made changes:
    - Run `npm run format` to fix formatting.
    - Commit: `docs: update documentation for <what changed>`.
    - Push to the PR branch.

11. **Final status** — Report the PR URL and a summary of all reviews and fixes:
    - Architecture review: N issues found, N fixed
    - Security review: N issues found, N fixed
    - Performance review: N issues found, N fixed
    - Documentation: updated / no changes needed
