---
description: Update the progress percentage and status for a component version
---

Update the progress and status for a specific component version milestone.

**User request**: $ARGUMENTS

Follow these steps:

1. **Parse the request** to determine:
   - `nodeId` — the component ID (e.g., `supervisor`, `worker`)
   - `version` — which version milestone (overview, mvp, v1, v2)
   - `progress` — percentage from 0 to 100
   - `status` — one of: `planned`, `in-progress`, `complete`

2. **Run the CLI adapter**:
   ```
   npx tsx src/adapters/cli/component-update.ts "<nodeId>" "<version>" <progress> "<status>"
   ```

3. **Publish** the changes to the website:
   ```
   npx tsx src/adapters/cli/component-publish.ts
   ```

4. **Report** the updated progress to the user.

Status guide:
- `planned` — work has not started (progress should be 0)
- `in-progress` — actively being worked on (progress 1-99)
- `complete` — finished (progress should be 100)
