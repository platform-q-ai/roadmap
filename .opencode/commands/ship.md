---
description: Commit, push, create PR, and trigger architecture review
agent: build
---

Complete the shipping workflow for the current branch:

1. **Pre-flight checks** — Run the full pre-commit pipeline (`npm run pre-commit`). Stop if anything fails.

2. **Commit** — If there are uncommitted changes, stage them and create a conventional commit. Analyze the diff to write an accurate commit message. If there are no changes, skip to step 3.

3. **Push** — Push the current branch to origin with `-u` to set upstream tracking.

4. **Create PR** — Use `gh pr create` to open a pull request against `main`. The PR title should match the commit message. The body should include a `## Summary` section with 2-4 bullet points describing the changes. If a PR already exists for this branch, skip creation.

5. **Architecture Review** — Invoke the `@architecture-reviewer` subagent with the PR number. It will review the diff for Clean Architecture adherence, code quality, and project standards, and leave comments directly on the PR.

6. **Address feedback** — Read each comment left by the reviewer. For each one:
   - Make the required code change.
   - Run `npm run lint && npm run test:unit` to verify the fix.
   - Commit the fix with a message like `fix(<scope>): address review — <what was fixed>`.
   - Resolve the comment on GitHub using `gh api`.
   
7. **Push fixes** — Push all fix commits to the PR branch.

8. **Final status** — Report the PR URL and a summary of what was reviewed and fixed.
