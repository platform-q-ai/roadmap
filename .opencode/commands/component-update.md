---
description: Update a component's properties such as progress, status, or version content
---

Update a component's properties in the architecture database.

**User request**: $ARGUMENTS

**API base URL**: `http://localhost:3000`

This command supports updating:
- **Progress and status** for a specific version (mvp, v1, v2)
- **Version content** (description text for a version milestone)

Follow these steps:

1. **Parse the request** to determine:
   - `nodeId` — the component to update
   - `version` — which version to update (overview, mvp, v1, v2)
   - `progress` — percentage 0-100
   - `status` — one of: planned, in-progress, complete

2. **Update progress** via PATCH /api/components/:id/versions/:version/progress:
   ```
   curl -X PATCH http://localhost:3000/api/components/<nodeId>/versions/<version>/progress \
     -H "Content-Type: application/json" \
     -d '{"progress":<progress>,"status":"<status>"}'
   ```
   - Returns `200` on success with the updated values
   - Returns `400` if progress or status values are invalid

3. **Report** the result to the user.

For bulk updates (e.g., marking multiple components as in-progress), send multiple PATCH requests.
