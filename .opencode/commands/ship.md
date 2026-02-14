---
description: Ship current branch — commit, push, PR, review, fix, docs
agent: build
---
1. Run `npm run pre-commit`. Stop on failure.
2. If uncommitted changes: stage all, conventional commit from diff analysis. Else skip.
3. `git push -u origin <branch>`.
4. `gh pr create --base master` with commit title + `## Summary` (2-4 bullets). Skip if PR exists.
5. Run `@architecture-reviewer` on the PR.
6. Run `@security-reviewer` on the PR.
7. Run `@performance-reviewer` on the PR.
8. For each reviewer comment: fix code, `npm run lint && npm run test:unit`, commit `fix(<scope>): address review — <what>`, resolve thread via `gh api graphql` `resolveReviewThread`.
9. Push fix commits.
10. Run `@documentation-updater` on the PR. If changes: `npm run format`, commit `docs: update documentation for <what>`, push.
11. Report PR URL + review summary (N found/fixed per reviewer, docs updated or not).
