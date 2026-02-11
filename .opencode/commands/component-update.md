---
description: Update a component's properties such as progress, status, or version content
---

Update a component's properties in the architecture database.

**User request**: $ARGUMENTS

This command supports updating:
- **Progress and status** for a specific version (mvp, v1, v2)
- **Version content** (description text for a version milestone)

Follow these steps:

1. **Parse the request** to determine:
   - `nodeId` — the component to update
   - `version` — which version to update (overview, mvp, v1, v2)
   - `progress` — percentage 0-100
   - `status` — one of: planned, in-progress, complete

2. **Run the CLI adapter** to update progress:
   ```
   npx tsx src/adapters/cli/component-update.ts "<nodeId>" "<version>" <progress> "<status>"
   ```

3. **Publish** the changes to the website:
   ```
   npx tsx src/adapters/cli/component-publish.ts
   ```

4. **Report** the result to the user.

For bulk updates (e.g., marking multiple components as in-progress), run the CLI adapter multiple times.
