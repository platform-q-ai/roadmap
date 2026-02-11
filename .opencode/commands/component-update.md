---
description: Update a component's version content such as description text for a version milestone
---

Update a component's version content in the architecture database.

**User request**: $ARGUMENTS

**API base URL**: `https://roadmap-5vvp.onrender.com`

This command supports updating **version content** (description text for a version milestone). Progress is derived automatically from the `current_version` field and cannot be set manually.

Follow these steps:

1. **Parse the request** to determine:
   - `nodeId` — the component to update
   - `version` — which version to update (overview, mvp, v1, v2)
   - `content` — the new description text

2. **Update version content** via PUT /api/components/:id/versions/:version:
   ```
   curl -X PUT https://roadmap-5vvp.onrender.com/api/components/<nodeId>/versions/<version> \
     -H "Content-Type: application/json" \
     -d '{"content":"<content>"}'
   ```
   - Returns `200` on success with the updated version
   - Returns `404` if the component or version does not exist

3. **Report** the result to the user.

For bulk updates, send multiple PUT requests.
