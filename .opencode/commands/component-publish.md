---
description: Publish architecture changes to the website by rebuilding data.json
---

Publish all pending architecture changes to the website.

This command rebuilds the web/data.json file from the current database state, making all component changes visible in the web view.

Follow these steps:

1. **Seed feature files** into the database (picks up any new .feature files):
   ```
   npx tsx src/adapters/cli/seed-features.ts
   ```

2. **Export** the architecture data to JSON:
   ```
   npx tsx src/adapters/cli/component-publish.ts
   ```

3. **Report** the result including the count of nodes, edges, versions, and features exported.

4. Optionally, suggest the user run `npm run serve` to preview the changes locally.
