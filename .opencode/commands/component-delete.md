---
description: Delete a component and all its related data from the roadmap
---

Delete a component from the architecture database, removing all related versions, features, and edges.

**User request**: $ARGUMENTS

Follow these steps:

1. **Parse the request** to determine the component ID to delete.

2. **Verify** the component exists by checking seed.sql or running:
   ```
   sqlite3 db/architecture.db "SELECT id, name FROM nodes WHERE id = '<id>'"
   ```

3. **Run the CLI adapter** to delete the component:
   ```
   npx tsx src/adapters/cli/component-delete.ts "<id>"
   ```

4. **Publish** the changes to the website:
   ```
   npx tsx src/adapters/cli/export.ts
   ```

5. **Report** the result to the user, confirming what was removed.

WARNING: This permanently removes the component and all its versions, features, and edges. Ask the user to confirm before proceeding.
