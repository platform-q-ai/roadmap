---
description: Create a new component in the architecture roadmap
---

Create a new component in the architecture database based on the user's request.

**User request**: $ARGUMENTS

**API base URL**: `https://roadmap-5vvp.onrender.com`

Follow these steps:

1. **Parse the request** to determine the component details:
   - `id` (kebab-case identifier, e.g. `my-service`)
   - `name` (human-readable name, e.g. `My Service`)
   - `type` (one of: layer, component, store, external, phase, app)
   - `layer` (which layer it belongs to — check existing layers via `GET /api/components`)
   - `description` (optional)
   - `tags` (optional, array of strings)

2. **Create the component** via POST /api/components:
   ```
   curl -X POST https://roadmap-5vvp.onrender.com/api/components \
     -H "Content-Type: application/json" \
     -d '{"id":"<id>","name":"<name>","type":"<type>","layer":"<layer>","description":"<description>","tags":["<tag1>","<tag2>"]}'
   ```
   - Returns `201` on success with the created component summary
   - Returns `400` if required fields are missing or type is invalid
   - Returns `409` if a component with the same id already exists

3. **Verify** the component was created:
   ```
   curl https://roadmap-5vvp.onrender.com/api/components/<id>
   ```

4. **Report** the result to the user.

If the user did not specify a type, default to `component`. If they did not specify a layer, ask them to choose one.
