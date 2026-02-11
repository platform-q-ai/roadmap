---
description: Publish architecture changes to the website by rebuilding data.json
---

Publish all pending architecture changes to the website.

This command retrieves the current architecture data via the API and writes it to web/data.json, making all component changes visible in the web view.

**API base URL**: `http://localhost:3000`

Follow these steps:

1. **Fetch the full architecture** via GET /api/architecture:
   ```
   curl http://localhost:3000/api/architecture -o web/data.json
   ```
   - Returns `200` with the complete architecture graph (layers, nodes, edges, progression_tree, stats)

2. **Verify** the exported data by checking the file was written:
   ```
   curl http://localhost:3000/api/health
   ```
   - Confirms the API server is running and healthy

3. **Report** the result including the count of nodes, edges, versions, and features exported.

4. Optionally, suggest the user run `npm run serve` to preview the changes locally.
