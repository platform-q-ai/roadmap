@wip @v1
Feature: API Component and Graph Management
  As an LLM engineer using the roadmap API headlessly
  I want comprehensive endpoints to manage components, edges, and versions
  So that I can programmatically build and maintain the architecture graph
  without any manual intervention or web UI interaction

  The MVP API provides basic CRUD for components and simple progress updates.
  V1 extends this with full edge management, version lifecycle, bulk operations,
  component search, filtering, and batch mutations. Every mutation endpoint
  validates inputs rigorously and returns structured error responses.
  All endpoints require appropriate API key scopes (see v1-secure-api.feature).

  # ── Component CRUD (Enhanced) ───────────────────────────────────────

  Rule: Components can be created, read, updated, and deleted via the API

    Scenario: Create a component with all fields
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body:
        """
        {
          "id": "full-component",
          "name": "Full Component",
          "type": "component",
          "layer": "supervisor-layer",
          "description": "A fully specified component for testing",
          "tags": ["runtime", "core", "v1"],
          "color": "#3498DB",
          "icon": "server",
          "sort_order": 42
        }
        """
      Then the response status is 201
      And the response body has field "id" with value "full-component"
      And the response body has field "description"
      And the response body has field "tags" containing "runtime"
      And the response body has field "color" with value "#3498DB"
      And the response body has field "sort_order" with value "42"

    Scenario: Create a component with minimal fields
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body:
        """
        {"id":"minimal-comp","name":"Minimal","type":"component","layer":"supervisor-layer"}
        """
      Then the response status is 201
      And the response body has field "description" with value null
      And the response body has field "tags" as an empty array
      And the response body has field "sort_order" with value "0"

    Scenario: Create a store-type component
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body:
        """
        {"id":"new-store","name":"New Store","type":"store","layer":"shared-state"}
        """
      Then the response status is 201
      And the response body has field "type" with value "store"

    Scenario: Create an app-type component
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body:
        """
        {"id":"new-app","name":"New App","type":"app","layer":"supervisor-layer"}
        """
      Then the response status is 201
      And the response body has field "type" with value "app"

    Scenario: Reject component with invalid type
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body:
        """
        {"id":"bad-type","name":"Bad","type":"widget","layer":"supervisor-layer"}
        """
      Then the response status is 400
      And the response body has field "error" containing "type"

    Scenario: Reject component with invalid layer reference
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body:
        """
        {"id":"bad-layer","name":"Bad","type":"component","layer":"nonexistent-layer"}
        """
      Then the response status is 400
      And the response body has field "error" containing "layer"

    Scenario: Reject component with ID longer than 64 characters
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with an ID of 65 characters
      Then the response status is 400
      And the response body has field "error" containing "id"

    Scenario: Reject component with empty name
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body:
        """
        {"id":"no-name","name":"","type":"component","layer":"supervisor-layer"}
        """
      Then the response status is 400
      And the response body has field "error" containing "name"

  # ── Component Update ────────────────────────────────────────────────

  Rule: Components can be partially updated via PATCH

    Scenario: Update component name
      Given the API server is running
      And a valid API key with scope "write"
      And a component "patch-comp" exists
      When I send a PATCH request to "/api/components/patch-comp" with body:
        """
        {"name":"Updated Name"}
        """
      Then the response status is 200
      And the response body has field "name" with value "Updated Name"
      And the response body has field "id" with value "patch-comp"

    Scenario: Update component description
      Given the API server is running
      And a valid API key with scope "write"
      And a component "desc-comp" exists
      When I send a PATCH request to "/api/components/desc-comp" with body:
        """
        {"description":"New description for the component"}
        """
      Then the response status is 200
      And the response body has field "description" with value "New description for the component"

    Scenario: Update component tags
      Given the API server is running
      And a valid API key with scope "write"
      And a component "tag-comp" exists with tags ["old"]
      When I send a PATCH request to "/api/components/tag-comp" with body:
        """
        {"tags":["new","updated"]}
        """
      Then the response status is 200
      And the response body has field "tags" containing "new" and "updated"

    Scenario: Update component sort_order
      Given the API server is running
      And a valid API key with scope "write"
      And a component "sort-comp" exists with sort_order 10
      When I send a PATCH request to "/api/components/sort-comp" with body:
        """
        {"sort_order":99}
        """
      Then the response status is 200
      And the response body has field "sort_order" with value "99"

    Scenario: Update component current_version
      Given the API server is running
      And a valid API key with scope "write"
      And a component "ver-comp" exists with current_version null
      When I send a PATCH request to "/api/components/ver-comp" with body:
        """
        {"current_version":"0.5.0"}
        """
      Then the response status is 200
      And the response body has field "current_version" with value "0.5.0"

    Scenario: Update component current_version triggers progress recalculation
      Given the API server is running
      And a valid API key with scope "write"
      And a component "recalc-comp" exists with version "mvp" at progress 0
      When I send a PATCH request to "/api/components/recalc-comp" with body:
        """
        {"current_version":"0.7.5"}
        """
      Then the response status is 200
      And the version "mvp" for "recalc-comp" now has derived progress 75

    Scenario: Reject update with invalid current_version format
      Given the API server is running
      And a valid API key with scope "write"
      And a component "bad-ver-comp" exists
      When I send a PATCH request to "/api/components/bad-ver-comp" with body:
        """
        {"current_version":"not-semver"}
        """
      Then the response status is 400
      And the response body has field "error" containing "version"

    Scenario: Update nonexistent component returns 404
      Given the API server is running
      And a valid API key with scope "write"
      When I send a PATCH request to "/api/components/ghost" with body:
        """
        {"name":"Ghost"}
        """
      Then the response status is 404

    Scenario: Update preserves unmodified fields
      Given the API server is running
      And a valid API key with scope "write"
      And a component "preserve-comp" exists with name "Original" and description "Keep me"
      When I send a PATCH request to "/api/components/preserve-comp" with body:
        """
        {"name":"Changed"}
        """
      Then the response body has field "name" with value "Changed"
      And the response body has field "description" with value "Keep me"

  # ── Component Listing and Filtering ─────────────────────────────────

  Rule: Components can be listed with filtering and search

    Scenario: List all components
      Given the API server is running
      And a valid API key with scope "read"
      And the database contains 60 components
      When I send a GET request to "/api/components"
      Then the response status is 200
      And the response body is an array
      And layers are excluded from the result

    Scenario: Filter components by type
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/components?type=store"
      Then the response status is 200
      And every item in the response has type "store"

    Scenario: Filter components by layer
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/components?layer=supervisor-layer"
      Then the response status is 200
      And every item in the response has layer "supervisor-layer"

    Scenario: Filter components by tag
      Given the API server is running
      And a valid API key with scope "read"
      And components with tag "runtime" exist
      When I send a GET request to "/api/components?tag=runtime"
      Then the response status is 200
      And every item in the response has "runtime" in its tags

    Scenario: Search components by name (partial match)
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/components?search=proxy"
      Then the response status is 200
      And every item has "proxy" in its name (case-insensitive)

    Scenario: Combine multiple filters
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/components?type=component&layer=supervisor-layer"
      Then the response status is 200
      And every item has type "component" and layer "supervisor-layer"

    Scenario: Empty filter result returns empty array
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/components?type=nonexistent"
      Then the response status is 200
      And the response body is an empty array

  # ── Edge Management ─────────────────────────────────────────────────

  Rule: Edges can be created, read, and deleted via the API

    Scenario: Create a new edge between components
      Given the API server is running
      And a valid API key with scope "write"
      And components "edge-src" and "edge-tgt" exist
      When I send a POST request to "/api/edges" with body:
        """
        {"source_id":"edge-src","target_id":"edge-tgt","type":"DEPENDS_ON"}
        """
      Then the response status is 201
      And the response body has field "source_id" with value "edge-src"
      And the response body has field "target_id" with value "edge-tgt"
      And the response body has field "type" with value "DEPENDS_ON"

    Scenario: Create an edge with label and metadata
      Given the API server is running
      And a valid API key with scope "write"
      And components "meta-src" and "meta-tgt" exist
      When I send a POST request to "/api/edges" with body:
        """
        {
          "source_id": "meta-src",
          "target_id": "meta-tgt",
          "type": "CONTROLS",
          "label": "spawns and monitors",
          "metadata": {"restart_policy": "always", "max_retries": 5}
        }
        """
      Then the response status is 201
      And the response body has field "label" with value "spawns and monitors"
      And the response body has field "metadata"

    Scenario: Reject edge with invalid type
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/edges" with body:
        """
        {"source_id":"a","target_id":"b","type":"INVALID_TYPE"}
        """
      Then the response status is 400
      And the response body has field "error" containing "type"

    Scenario: Reject edge with nonexistent source
      Given the API server is running
      And a valid API key with scope "write"
      And component "real-tgt" exists but "fake-src" does not
      When I send a POST request to "/api/edges" with body:
        """
        {"source_id":"fake-src","target_id":"real-tgt","type":"DEPENDS_ON"}
        """
      Then the response status is 400
      And the response body has field "error" containing "source"

    Scenario: Reject edge with nonexistent target
      Given the API server is running
      And a valid API key with scope "write"
      And component "real-src" exists but "fake-tgt" does not
      When I send a POST request to "/api/edges" with body:
        """
        {"source_id":"real-src","target_id":"fake-tgt","type":"DEPENDS_ON"}
        """
      Then the response status is 400
      And the response body has field "error" containing "target"

    Scenario: Reject duplicate edge (same source, target, type)
      Given the API server is running
      And a valid API key with scope "write"
      And an edge from "dup-src" to "dup-tgt" with type "DEPENDS_ON" already exists
      When I send a POST request to "/api/edges" with the same edge
      Then the response status is 409
      And the response body has field "error" containing "already exists"

    Scenario: Reject self-referencing edge
      Given the API server is running
      And a valid API key with scope "write"
      And component "self-ref" exists
      When I send a POST request to "/api/edges" with body:
        """
        {"source_id":"self-ref","target_id":"self-ref","type":"DEPENDS_ON"}
        """
      Then the response status is 400
      And the response body has field "error" containing "self-referencing"

    Scenario: List all edges for a component
      Given the API server is running
      And a valid API key with scope "read"
      And component "hub-comp" has 3 inbound and 2 outbound edges
      When I send a GET request to "/api/components/hub-comp/edges"
      Then the response status is 200
      And the response body has field "inbound" as an array of 3 edges
      And the response body has field "outbound" as an array of 2 edges

    Scenario: Filter edges by type
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/edges?type=DEPENDS_ON"
      Then the response status is 200
      And every edge in the response has type "DEPENDS_ON"

    Scenario: List all edges in the graph
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/edges"
      Then the response status is 200
      And the response body is a non-empty array of edge objects

    Scenario: Delete an edge
      Given the API server is running
      And a valid API key with scope "write"
      And an edge with id 42 exists
      When I send a DELETE request to "/api/edges/42"
      Then the response status is 204
      And the edge no longer exists

    Scenario: Delete nonexistent edge returns 404
      Given the API server is running
      And a valid API key with scope "write"
      When I send a DELETE request to "/api/edges/99999"
      Then the response status is 404

  # ── Version Management ──────────────────────────────────────────────

  Rule: Component versions can be managed via the API

    Scenario: List versions for a component
      Given the API server is running
      And a valid API key with scope "read"
      And component "ver-list" has versions "overview", "mvp", "v1", "v2"
      When I send a GET request to "/api/components/ver-list/versions"
      Then the response status is 200
      And the response body is an array of 4 version objects
      And each version has fields: version, content, progress, status, updated_at
      And each phase version (mvp, v1, v2) includes step-based progress fields:
        | field          | description                              |
        | total_steps    | Total Given/When/Then steps for version  |
        | passing_steps  | Steps in passing scenarios               |
        | step_progress  | passing_steps / total_steps * 100        |

    Scenario: Get a single version for a component
      Given the API server is running
      And a valid API key with scope "read"
      And component "ver-single" has version "mvp" with progress 75
      When I send a GET request to "/api/components/ver-single/versions/mvp"
      Then the response status is 200
      And the response body has field "version" with value "mvp"
      And the response body has field "progress" with value "75"

    Scenario: Create or update version content
      Given the API server is running
      And a valid API key with scope "write"
      And component "ver-upsert" exists
      When I send a PUT request to "/api/components/ver-upsert/versions/v1" with body:
        """
        {
          "content": "V1 adds Neo4j storage, secure API, and feature-driven progress tracking.",
          "progress": 0,
          "status": "planned"
        }
        """
      Then the response status is 200
      And the response body has field "version" with value "v1"
      And the response body has field "content"

    Scenario: Delete all versions for a component
      Given the API server is running
      And a valid API key with scope "write"
      And component "ver-del" has versions "overview", "mvp", "v1"
      When I send a DELETE request to "/api/components/ver-del/versions"
      Then the response status is 204
      And no versions exist for "ver-del"

    Scenario: Version progress reflects step-based calculation
      Given the API server is running
      And a valid API key with scope "read"
      And component "step-ver" has version "v1" with 40 total steps and 30 passing
      When I send a GET request to "/api/components/step-ver/versions/v1"
      Then the response status is 200
      And the response body has field "total_steps" with value "40"
      And the response body has field "passing_steps" with value "30"
      And the response body has field "step_progress" with value "75"
      And the response body has field "progress" reflecting the combined weighted value

  # ── Bulk Operations ─────────────────────────────────────────────────

  Rule: Bulk operations allow efficient batch mutations

    Scenario: Bulk create multiple components
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/bulk/components" with body:
        """
        {
          "components": [
            {"id":"bulk-1","name":"Bulk One","type":"component","layer":"supervisor-layer"},
            {"id":"bulk-2","name":"Bulk Two","type":"component","layer":"supervisor-layer"},
            {"id":"bulk-3","name":"Bulk Three","type":"store","layer":"shared-state"}
          ]
        }
        """
      Then the response status is 201
      And the response body has field "created" with value 3
      And the response body has field "errors" as an empty array

    Scenario: Bulk create with partial failure
      Given the API server is running
      And a valid API key with scope "write"
      And component "existing-bulk" already exists
      When I send a POST request to "/api/bulk/components" with body:
        """
        {
          "components": [
            {"id":"new-bulk","name":"New","type":"component","layer":"supervisor-layer"},
            {"id":"existing-bulk","name":"Dup","type":"component","layer":"supervisor-layer"}
          ]
        }
        """
      Then the response status is 207
      And the response body has field "created" with value 1
      And the response body has field "errors" as an array of 1 error
      And the error references "existing-bulk" with status 409

    Scenario: Bulk create edges
      Given the API server is running
      And a valid API key with scope "write"
      And components "b-src-1", "b-src-2", "b-tgt" exist
      When I send a POST request to "/api/bulk/edges" with body:
        """
        {
          "edges": [
            {"source_id":"b-src-1","target_id":"b-tgt","type":"DEPENDS_ON"},
            {"source_id":"b-src-2","target_id":"b-tgt","type":"DEPENDS_ON"}
          ]
        }
        """
      Then the response status is 201
      And the response body has field "created" with value 2

    Scenario: Bulk operations are limited to 100 items
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/bulk/components" with 101 components
      Then the response status is 400
      And the response body has field "error" containing "maximum 100"

    Scenario: Bulk delete components
      Given the API server is running
      And a valid API key with scope "write"
      And components "del-1", "del-2", "del-3" exist
      When I send a POST request to "/api/bulk/delete/components" with body:
        """
        {"ids":["del-1","del-2","del-3"]}
        """
      Then the response status is 200
      And the response body has field "deleted" with value 3

  # ── Layer Management ────────────────────────────────────────────────

  Rule: Layers can be managed alongside components

    Scenario: List all layers
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/layers"
      Then the response status is 200
      And the response body is an array of layer objects
      And each layer has field "type" with value "layer"

    Scenario: Get a layer with its children
      Given the API server is running
      And a valid API key with scope "read"
      And layer "supervisor-layer" contains 4 components
      When I send a GET request to "/api/layers/supervisor-layer"
      Then the response status is 200
      And the response body has field "id" with value "supervisor-layer"
      And the response body has field "children" as an array of 4 components

    Scenario: Create a new layer
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/layers" with body:
        """
        {"id":"new-layer","name":"New Layer","color":"#E74C3C","icon":"layers"}
        """
      Then the response status is 201
      And the response body has field "type" with value "layer"

    Scenario: Move a component to a different layer
      Given the API server is running
      And a valid API key with scope "write"
      And component "movable-comp" is in layer "old-layer"
      When I send a PATCH request to "/api/components/movable-comp" with body:
        """
        {"layer":"new-layer"}
        """
      Then the response status is 200
      And the CONTAINS edge from "old-layer" to "movable-comp" is removed
      And a CONTAINS edge from "new-layer" to "movable-comp" is created

  # ── Architecture Graph Endpoint (Enhanced) ──────────────────────────

  Rule: The architecture endpoint returns the full enriched graph

    Scenario: Get full architecture graph
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/architecture"
      Then the response status is 200
      And the response body has field "generated_at" as an ISO 8601 timestamp
      And the response body has field "layers" as a non-empty array
      And the response body has field "nodes" as a non-empty array
      And the response body has field "edges" as a non-empty array
      And the response body has field "progression_tree"
      And the response body has field "stats"

    Scenario: Architecture stats are accurate
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/architecture"
      Then the stats field has "total_nodes" matching the actual node count
      And the stats field has "total_edges" matching the actual edge count
      And the stats field has "total_versions" matching the actual version count
      And the stats field has "total_features" matching the actual feature count

    Scenario: Enriched nodes include versions and features
      Given the API server is running
      And a valid API key with scope "read"
      And component "enriched-comp" has versions and features
      When I send a GET request to "/api/architecture"
      Then the node "enriched-comp" in the response has field "versions"
      And the node "enriched-comp" has field "features"
      And the node "enriched-comp" has field "display_state"

    Scenario: Progression tree contains only app-type nodes
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/architecture"
      Then every node in the progression_tree has type "app"
      And every edge in the progression_tree has type "DEPENDS_ON"

    Scenario: Architecture response uses derived progress
      Given the API server is running
      And a valid API key with scope "read"
      And component "derived-comp" has current_version "0.7.5"
      When I send a GET request to "/api/architecture"
      Then the version "mvp" for node "derived-comp" has progress 75 in the response
