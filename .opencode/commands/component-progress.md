---
description: Update the progress percentage and status for a component version
---

Update the progress and status for a specific component version milestone.

**User request**: $ARGUMENTS

**API base URL**: `https://roadmap-5vvp.onrender.com`

Follow these steps:

1. **Parse the request** to determine:
   - `nodeId` — the component ID (e.g., `supervisor`, `worker`)
   - `version` — which version milestone (overview, mvp, v1, v2)
   - `progress` — percentage from 0 to 100
   - `status` — one of: `planned`, `in-progress`, `complete`

2. **Update progress** via PATCH /api/components/:id/versions/:version/progress:
   ```
   curl -X PATCH https://roadmap-5vvp.onrender.com/api/components/<nodeId>/versions/<version>/progress \
     -H "Content-Type: application/json" \
     -d '{"progress":<progress>,"status":"<status>"}'
   ```
   - Returns `200` on success with the updated values
   - Returns `400` if progress or status values are invalid

3. **Report** the updated progress to the user.

Status guide:
- `planned` — work has not started (progress should be 0)
- `in-progress` — actively being worked on (progress 1-99)
- `complete` — finished (progress should be 100)
