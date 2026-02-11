---
description: Delete a component and all its related data from the roadmap
---

Delete a component from the architecture database, removing all related versions, features, and edges.

**User request**: $ARGUMENTS

**API base URL**: `https://roadmap-5vvp.onrender.com`

Follow these steps:

1. **Parse the request** to determine the component ID to delete.

2. **Verify** the component exists:
   ```
   curl https://roadmap-5vvp.onrender.com/api/components/<id>
   ```
   - Returns `200` with component details if it exists
   - Returns `404` if the component does not exist

3. **Confirm** with the user before proceeding — this permanently removes the component and all its versions, features, and edges.

4. **Delete the component** via DELETE /api/components/:id:
   ```
   curl -X DELETE https://roadmap-5vvp.onrender.com/api/components/<id>
   ```
   - Returns `204` (no content) on success
   - Returns `404` if the component does not exist

5. **Report** the result to the user, confirming what was removed.

WARNING: This permanently removes the component and all its versions, features, and edges. Ask the user to confirm before proceeding.
