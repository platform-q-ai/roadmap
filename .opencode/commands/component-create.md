---
description: Create a new component in the architecture roadmap
---

Create a new component in the architecture database based on the user's request.

**User request**: $ARGUMENTS

Follow these steps:

1. **Parse the request** to determine the component details:
   - `id` (kebab-case identifier, e.g. `my-service`)
   - `name` (human-readable name, e.g. `My Service`)
   - `type` (one of: layer, component, store, external, phase, app)
   - `layer` (which layer it belongs to — check existing layers in seed.sql)
   - `description` (optional)
   - `tags` (optional, comma-separated)

2. **Run the CLI adapter** to create the component:
   ```
   npx tsx src/adapters/cli/component-create.ts "<id>" "<name>" "<type>" "<layer>" "<description>" "<tags>"
   ```

3. **Publish** the changes to the website:
   ```
   npx tsx src/adapters/cli/component-publish.ts
   ```

4. **Report** the result to the user.

If the user did not specify a type, default to `component`. If they did not specify a layer, ask them to choose one.
