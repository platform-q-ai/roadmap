@wip @v1
Feature: API Feature File Publishing and Graph Traversal
  As an LLM engineer working autonomously
  I want API endpoints to publish, retrieve, and validate Gherkin feature files
  with an explicit version parameter that categorises every feature
  and traverse the architecture graph to understand component dependencies
  So that I can headlessly manage version-tagged BDD specifications for each
  component, and the system can calculate completion rates using total steps
  versus passing steps per version tier

  The MVP API supports basic feature upload with version derived from filename.
  V1 makes version a mandatory part of the upload URL path, ensuring every
  feature file is explicitly categorised under a version (mvp, v1, v2, etc.).
  This enables precise step-level progress maths: the app counts total Given/
  When/Then steps across all features for a version, compares them against
  passing steps from test results, and derives a completion percentage.

  V1 also adds Gherkin validation, batch publishing with required version
  fields, version-scoped retrieval and deletion, and rich graph traversal
  endpoints purpose-built for autonomous coding agents.

  # ── Version-Scoped Feature Upload ───────────────────────────────────

  Rule: Feature uploads require an explicit version in the URL path

    Scenario: Upload a feature file with explicit version in path
      Given the API server is running
      And a valid API key with scope "write"
      And a component "upload-comp" exists
      When I send a PUT request to "/api/components/upload-comp/versions/v1/features/neo4j-storage.feature" with body:
        """
        Feature: Neo4j Storage
          As a developer
          I want data stored in Neo4j
          So that graph traversals are efficient

          Scenario: Save a node
            Given an empty database
            When I save a node with id "test"
            Then the node exists in Neo4j
        """
      Then the response status is 200
      And the response body has field "filename" with value "neo4j-storage.feature"
      And the response body has field "version" with value "v1"
      And the response body has field "title" with value "Neo4j Storage"
      And the response body has field "node_id" with value "upload-comp"
      And the response body has field "step_count" with value "3"

    Scenario: Upload a feature to the MVP version
      Given the API server is running
      And a valid API key with scope "write"
      And a component "mvp-comp" exists
      When I send a PUT request to "/api/components/mvp-comp/versions/mvp/features/basic-crud.feature" with body:
        """
        Feature: Basic CRUD
          Scenario: Create a record
            Given no records exist
            When I create a record
            Then 1 record exists
        """
      Then the response status is 200
      And the response body has field "version" with value "mvp"
      And the response body has field "step_count" with value "3"

    Scenario: Upload a feature to the V2 version
      Given the API server is running
      And a valid API key with scope "write"
      And a component "v2-comp" exists
      When I send a PUT request to "/api/components/v2-comp/versions/v2/features/advanced-search.feature" with body:
        """
        Feature: Advanced Search
          Scenario: Full-text search
            Given indexed content exists
            When I search for "keyword"
            Then matching results are returned
            And results are ranked by relevance
        """
      Then the response status is 200
      And the response body has field "version" with value "v2"
      And the response body has field "step_count" with value "4"

    Scenario: Version in path overrides any filename prefix
      Given the API server is running
      And a valid API key with scope "write"
      And a component "override-comp" exists
      When I send a PUT request to "/api/components/override-comp/versions/v1/features/mvp-legacy-name.feature" with body:
        """
        Feature: Legacy Named Feature
          Scenario: A scenario
            Given a step
            When an action
            Then a result
        """
      Then the response status is 200
      And the response body has field "version" with value "v1"
      And the feature is stored under version "v1" regardless of the "mvp-" filename prefix

    Scenario: Reject upload with invalid version value
      Given the API server is running
      And a valid API key with scope "write"
      And a component "bad-ver" exists
      When I send a PUT request to "/api/components/bad-ver/versions/invalid/features/test.feature" with Gherkin content
      Then the response status is 400
      And the response body has field "error" containing "version"
      And the response body has field "error" containing "mvp, v1, v2"

    Scenario: Reject upload without version in path (old MVP-style URL)
      Given the API server is running
      And a valid API key with scope "write"
      When I send a PUT request to "/api/components/some-comp/features/test.feature" with Gherkin content
      Then the response status is 400
      And the response body has field "error" containing "version is required"

    Scenario: Upload extracts title from Feature: line
      Given the API server is running
      And a valid API key with scope "write"
      And a component "title-comp" exists
      When I send a PUT request to "/api/components/title-comp/versions/v1/features/my-feature.feature" with body:
        """
        Feature: My Custom Title Here
          Scenario: Something
            Given a step
            When an action
            Then a result
        """
      Then the response body has field "title" with value "My Custom Title Here"

    Scenario: Upload to nonexistent component returns 404
      Given the API server is running
      And a valid API key with scope "write"
      When I send a PUT request to "/api/components/ghost/versions/v1/features/test.feature" with body:
        """
        Feature: Ghost Upload
          Scenario: Test
            Given a step
        """
      Then the response status is 404
      And the response body has field "error" containing "not found"

    Scenario: Upload replaces existing feature with same filename and version
      Given the API server is running
      And a valid API key with scope "write"
      And component "replace-comp" has feature "existing.feature" under version "v1" with title "Old"
      When I send a PUT request to "/api/components/replace-comp/versions/v1/features/existing.feature" with body:
        """
        Feature: New Title
          Scenario: Updated scenario
            Given a new step
            When a new action
            Then a new result
        """
      Then the response status is 200
      And the response body has field "title" with value "New Title"
      And only one feature with filename "existing.feature" exists for "replace-comp" version "v1"

    Scenario: Same filename under different versions creates separate records
      Given the API server is running
      And a valid API key with scope "write"
      And a component "multi-ver" exists
      When I upload "auth.feature" to "multi-ver" under version "mvp" with 3 steps
      And I upload "auth.feature" to "multi-ver" under version "v1" with 8 steps
      Then 2 feature records exist for "multi-ver" with filename "auth.feature"
      And the "mvp" version has step_count 3
      And the "v1" version has step_count 8

    Scenario: Upload preserves features under other versions
      Given the API server is running
      And a valid API key with scope "write"
      And component "preserve-comp" has features under versions "mvp" and "v1"
      When I upload a new feature under version "v2"
      Then the "mvp" and "v1" features are unchanged
      And "preserve-comp" now has features across 3 versions

    Scenario: Response includes step count breakdown
      Given the API server is running
      And a valid API key with scope "write"
      And a component "step-count-comp" exists
      When I send a PUT request to "/api/components/step-count-comp/versions/v1/features/detailed.feature" with body:
        """
        Feature: Detailed Steps
          Scenario: First scenario
            Given step one
            And step two
            When action one
            Then result one
            And result two
            But not result three

          Scenario: Second scenario
            Given step three
            When action two
            Then result four
        """
      Then the response status is 200
      And the response body has field "step_count" with value "9"
      And the response body has field "scenario_count" with value "2"
      And the response body has field "given_count" with value "3"
      And the response body has field "when_count" with value "2"
      And the response body has field "then_count" with value "4"

  # ── Feature File Validation ─────────────────────────────────────────

  Rule: Uploaded feature files are validated for Gherkin syntax

    Scenario: Valid Gherkin is accepted
      Given the API server is running
      And a valid API key with scope "write"
      And a component "valid-gherkin" exists
      When I send a PUT request to "/api/components/valid-gherkin/versions/v1/features/valid.feature" with valid Gherkin content
      Then the response status is 200

    Scenario: Feature file without Feature: keyword is rejected
      Given the API server is running
      And a valid API key with scope "write"
      And a component "bad-gherkin" exists
      When I send a PUT request to "/api/components/bad-gherkin/versions/v1/features/bad.feature" with body:
        """
        This is not a valid feature file.
        It has no Feature: keyword.
        """
      Then the response status is 400
      And the response body has field "error" containing "Feature"

    Scenario: Feature file without any scenarios is rejected
      Given the API server is running
      And a valid API key with scope "write"
      And a component "no-scenario" exists
      When I send a PUT request to "/api/components/no-scenario/versions/v1/features/empty.feature" with body:
        """
        Feature: Empty Feature
          This feature has a description but no scenarios.
        """
      Then the response status is 400
      And the response body has field "error" containing "scenario"

    Scenario: Feature file with empty body is rejected
      Given the API server is running
      And a valid API key with scope "write"
      And a component "empty-body" exists
      When I send a PUT request to "/api/components/empty-body/versions/v1/features/empty.feature" with empty body
      Then the response status is 400
      And the response body has field "error" containing "empty"

    Scenario: Feature file with scenarios but no steps is rejected
      Given the API server is running
      And a valid API key with scope "write"
      And a component "no-steps" exists
      When I send a PUT request to "/api/components/no-steps/versions/v1/features/stepless.feature" with body:
        """
        Feature: Stepless Feature
          Scenario: Empty scenario
        """
      Then the response status is 400
      And the response body has field "error" containing "steps"

    Scenario: Feature filename must end with .feature
      Given the API server is running
      And a valid API key with scope "write"
      And a component "bad-ext" exists
      When I send a PUT request to "/api/components/bad-ext/versions/v1/features/test.txt" with Gherkin content
      Then the response status is 400
      And the response body has field "error" containing ".feature"

    Scenario: Feature filename must be kebab-case
      Given the API server is running
      And a valid API key with scope "write"
      And a component "bad-name" exists
      When I send a PUT request to "/api/components/bad-name/versions/v1/features/under_score.feature" with Gherkin content
      Then the response status is 400
      And the response body has field "error" containing "filename"

    Scenario: Validation response includes line number for parse errors
      Given the API server is running
      And a valid API key with scope "write"
      And a component "parse-err" exists
      When I send a PUT request to "/api/components/parse-err/versions/v1/features/broken.feature" with Gherkin containing a syntax error at line 5
      Then the response status is 400
      And the response body has field "error" containing line number information

  # ── Version-Scoped Feature Retrieval ────────────────────────────────

  Rule: Feature files are retrieved scoped to their explicit version

    Scenario: List all features for a component across all versions
      Given the API server is running
      And a valid API key with scope "read"
      And component "feat-list" has 2 features under "mvp", 2 under "v1", 1 under "v2"
      When I send a GET request to "/api/components/feat-list/features"
      Then the response status is 200
      And the response body is an array of 5 feature objects
      And each object has fields: filename, version, title, content, step_count, updated_at

    Scenario: List features for a specific version
      Given the API server is running
      And a valid API key with scope "read"
      And component "feat-ver" has 3 "mvp" features and 4 "v1" features
      When I send a GET request to "/api/components/feat-ver/versions/v1/features"
      Then the response status is 200
      And the response body is an array of 4 features
      And every feature has version "v1"

    Scenario: Get a single feature by version and filename
      Given the API server is running
      And a valid API key with scope "read"
      And component "feat-single" has feature "auth.feature" under version "v1"
      When I send a GET request to "/api/components/feat-single/versions/v1/features/auth.feature"
      Then the response status is 200
      And the response body has field "filename" with value "auth.feature"
      And the response body has field "version" with value "v1"
      And the response body has field "content" containing the full Gherkin text
      And the response body has field "step_count"

    Scenario: Get feature from wrong version returns 404
      Given the API server is running
      And a valid API key with scope "read"
      And component "ver-miss" has feature "auth.feature" under version "mvp" only
      When I send a GET request to "/api/components/ver-miss/versions/v1/features/auth.feature"
      Then the response status is 404
      And the response body has field "error" containing "not found"

    Scenario: Get nonexistent feature returns 404
      Given the API server is running
      And a valid API key with scope "read"
      And component "feat-missing" exists
      When I send a GET request to "/api/components/feat-missing/versions/v1/features/ghost.feature"
      Then the response status is 404

    Scenario: Get features for nonexistent component returns 404
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/components/nonexistent/versions/v1/features"
      Then the response status is 404

    Scenario: Get raw feature content as plain text
      Given the API server is running
      And a valid API key with scope "read"
      And component "raw-feat" has feature "raw.feature" under version "v1"
      When I send a GET request to "/api/components/raw-feat/versions/v1/features/raw.feature" with header "Accept: text/plain"
      Then the response status is 200
      And the response content type is "text/plain"
      And the response body is the raw Gherkin text

    Scenario: Feature listing includes step counts for progress maths
      Given the API server is running
      And a valid API key with scope "read"
      And component "step-list" has 3 features under version "v1"
      When I send a GET request to "/api/components/step-list/versions/v1/features"
      Then each feature object has field "step_count" as a positive integer
      And each feature object has field "scenario_count" as a positive integer
      And the response includes a "totals" field with:
        | field               | description                         |
        | total_features      | Number of features in this version  |
        | total_scenarios     | Sum of scenarios across features    |
        | total_steps         | Sum of all steps across features    |
        | total_given_steps   | Sum of Given/And steps              |
        | total_when_steps    | Sum of When steps                   |
        | total_then_steps    | Sum of Then/But steps               |

  # ── Version-Scoped Feature Deletion ─────────────────────────────────

  Rule: Feature files can be deleted scoped to their version

    Scenario: Delete a single feature by version and filename
      Given the API server is running
      And a valid API key with scope "write"
      And component "del-feat" has feature "remove-me.feature" under version "v1"
      When I send a DELETE request to "/api/components/del-feat/versions/v1/features/remove-me.feature"
      Then the response status is 204
      And the feature "remove-me.feature" under version "v1" no longer exists for "del-feat"

    Scenario: Delete all features for a specific version
      Given the API server is running
      And a valid API key with scope "write"
      And component "del-ver" has 3 "mvp" and 2 "v1" features
      When I send a DELETE request to "/api/components/del-ver/versions/v1/features"
      Then the response status is 204
      And 3 "mvp" features still exist for "del-ver"
      And 0 "v1" features exist for "del-ver"

    Scenario: Delete all features across all versions
      Given the API server is running
      And a valid API key with scope "write"
      And component "del-all" has features under "mvp", "v1", and "v2"
      When I send a DELETE request to "/api/components/del-all/features"
      Then the response status is 204
      And no features exist for "del-all"

    Scenario: Delete nonexistent feature returns 404
      Given the API server is running
      And a valid API key with scope "write"
      When I send a DELETE request to "/api/components/del-feat/versions/v1/features/ghost.feature"
      Then the response status is 404

    Scenario: Deleting features triggers progress recalculation
      Given component "del-recalc" has features under version "v1" contributing to progress
      When I delete all features for "del-recalc" version "v1"
      Then the step-based progress for "del-recalc" version "v1" drops to 0 percent

  # ── Batch Feature Publishing with Explicit Version ──────────────────

  Rule: Batch uploads require an explicit version per feature entry

    Scenario: Batch upload features for a single component and version
      Given the API server is running
      And a valid API key with scope "write"
      And a component "batch-comp" exists
      When I send a POST request to "/api/components/batch-comp/versions/v1/features/batch" with body:
        """
        {
          "features": [
            {
              "filename": "first.feature",
              "content": "Feature: First\n  Scenario: S1\n    Given a step\n    When an action\n    Then a result"
            },
            {
              "filename": "second.feature",
              "content": "Feature: Second\n  Scenario: S2\n    Given another step\n    Then another result"
            }
          ]
        }
        """
      Then the response status is 201
      And the response body has field "uploaded" with value 2
      And the response body has field "version" with value "v1"
      And the response body has field "total_steps" with value "5"
      And the response body has field "errors" as an empty array

    Scenario: Batch upload with partial validation failure
      Given the API server is running
      And a valid API key with scope "write"
      And a component "batch-partial" exists
      When I send a POST request to "/api/components/batch-partial/versions/v1/features/batch" with body:
        """
        {
          "features": [
            {
              "filename": "valid.feature",
              "content": "Feature: Valid\n  Scenario: S1\n    Given a step"
            },
            {
              "filename": "invalid.feature",
              "content": "This is not valid Gherkin"
            }
          ]
        }
        """
      Then the response status is 207
      And the response body has field "uploaded" with value 1
      And the response body has field "errors" as an array of 1 error
      And the error references "invalid.feature"

    Scenario: Batch upload limited to 50 features
      Given the API server is running
      And a valid API key with scope "write"
      When I send a batch upload with 51 features
      Then the response status is 400
      And the response body has field "error" containing "maximum 50"

    Scenario: Cross-component batch publish requires version per entry
      Given the API server is running
      And a valid API key with scope "write"
      And components "cross-1" and "cross-2" exist
      When I send a POST request to "/api/features/batch" with body:
        """
        {
          "features": [
            {
              "node_id": "cross-1",
              "version": "v1",
              "filename": "a.feature",
              "content": "Feature: A\n  Scenario: S\n    Given a step"
            },
            {
              "node_id": "cross-2",
              "version": "v2",
              "filename": "b.feature",
              "content": "Feature: B\n  Scenario: S\n    Given a step\n    Then a result"
            }
          ]
        }
        """
      Then the response status is 201
      And "cross-1" has feature "a.feature" under version "v1"
      And "cross-2" has feature "b.feature" under version "v2"

    Scenario: Cross-component batch rejects entry without version field
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/features/batch" with body:
        """
        {
          "features": [
            {
              "node_id": "some-comp",
              "filename": "no-version.feature",
              "content": "Feature: Missing Version\n  Scenario: S\n    Given a step"
            }
          ]
        }
        """
      Then the response status is 400
      And the response body has field "error" containing "version is required"

    Scenario: Batch upload triggers progress recalculation once
      Given the API server is running
      And a valid API key with scope "write"
      And component "batch-recalc" exists
      When I batch upload 5 features to "batch-recalc" version "v1"
      Then progress recalculation happens once (not 5 times)
      And the step-based progress reflects all 5 features

  # ── Graph Traversal for Autonomous Coding ───────────────────────────

  Rule: LLM engineers can traverse the graph to plan implementation

    Scenario: Get dependency tree for a component
      Given the API server is running
      And a valid API key with scope "read"
      And component "dep-root" has dependencies "dep-a" and "dep-b"
      And "dep-a" has dependency "dep-c"
      When I send a GET request to "/api/components/dep-root/dependencies?depth=2"
      Then the response status is 200
      And the response body has field "dependencies" as a tree structure
      And the tree includes "dep-a", "dep-b" at depth 1
      And the tree includes "dep-c" at depth 2

    Scenario: Get reverse dependencies (dependents)
      Given the API server is running
      And a valid API key with scope "read"
      And components "consumer-1" and "consumer-2" depend on "provider"
      When I send a GET request to "/api/components/provider/dependents"
      Then the response status is 200
      And the response body contains "consumer-1" and "consumer-2"

    Scenario: Get full component context for coding
      Given the API server is running
      And a valid API key with scope "read"
      And component "context-comp" exists with versions, features, and edges
      When I send a GET request to "/api/components/context-comp/context"
      Then the response status is 200
      And the response body has field "component" with full component details
      And the response body has field "versions" with all version data including step counts
      And the response body has field "features" grouped by version with step counts
      And the response body has field "dependencies" with outbound DEPENDS_ON edges
      And the response body has field "dependents" with inbound DEPENDS_ON edges
      And the response body has field "layer" with the parent layer details
      And the response body has field "siblings" listing other components in the same layer
      And the response body has field "progress" with per-version step-based progress

    Scenario: Get implementation order via topological sort
      Given the API server is running
      And a valid API key with scope "read"
      And a dependency graph with no cycles
      When I send a GET request to "/api/graph/implementation-order"
      Then the response status is 200
      And the response body is an array of component IDs
      And every component appears after all its dependencies
      And the order is a valid topological sort

    Scenario: Implementation order detects cycles
      Given the API server is running
      And a valid API key with scope "read"
      And a circular dependency exists between "cycle-a", "cycle-b", "cycle-c"
      When I send a GET request to "/api/graph/implementation-order"
      Then the response status is 409
      And the response body has field "error" containing "cycle"
      And the response body has field "cycle" listing the involved components

    Scenario: Get components by completion status
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/graph/components-by-status?version=mvp"
      Then the response status is 200
      And the response body has field "complete" as an array of components with 100% step coverage
      And the response body has field "in_progress" as an array with partial step coverage
      And the response body has field "planned" as an array with 0% step coverage

    Scenario: Get next implementable components
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/graph/next-implementable?version=mvp"
      Then the response status is 200
      And the response body is an array of component objects
      And every component has all its dependencies at 100% step coverage for "mvp"
      And every component itself has step coverage below 100% for "mvp"

    Scenario: Get shortest path between two components
      Given the API server is running
      And a valid API key with scope "read"
      And components "path-start" and "path-end" are connected via intermediate nodes
      When I send a GET request to "/api/graph/path?from=path-start&to=path-end"
      Then the response status is 200
      And the response body has field "path" as an array of nodes
      And the response body has field "edges" describing each hop
      And the path is the shortest available route

    Scenario: Path between unconnected components returns empty
      Given the API server is running
      And a valid API key with scope "read"
      And components "island-1" and "island-2" have no connecting path
      When I send a GET request to "/api/graph/path?from=island-1&to=island-2"
      Then the response status is 200
      And the response body has field "path" as an empty array

    Scenario: Get component neighbourhood
      Given the API server is running
      And a valid API key with scope "read"
      And component "center" has edges to and from multiple components
      When I send a GET request to "/api/components/center/neighbourhood?hops=2"
      Then the response status is 200
      And the response body has field "nodes" with all components within 2 hops
      And the response body has field "edges" with all edges between those nodes
      And the response includes the edge types and directions

    Scenario: Get layer overview for planning
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/graph/layer-overview"
      Then the response status is 200
      And the response body is an array of layer summaries
      And each summary has field "layer_id"
      And each summary has field "total_components"
      And each summary has field "completed_mvp" as a count
      And each summary has field "completed_v1" as a count
      And each summary has field "overall_progress" as a percentage

  # ── Feature Seeding from Filesystem ─────────────────────────────────

  Rule: Feature files seeded from the filesystem use filename prefix for version

    Scenario: Trigger feature re-seed via API
      Given the API server is running
      And a valid API key with scope "admin"
      And feature files exist in the "components/" directory tree
      When I send a POST request to "/api/admin/seed-features"
      Then the response status is 200
      And the response body has field "seeded" with a positive integer
      And the response body has field "skipped" with an integer
      And features with "mvp-" prefix are stored under version "mvp"
      And features with "v1-" prefix are stored under version "v1"
      And features with "v2-" prefix are stored under version "v2"
      And features without a version prefix default to version "mvp"

    Scenario: Re-seed is idempotent
      Given the API server is running
      And a valid API key with scope "admin"
      When I trigger feature re-seed twice
      Then the second run produces the same result as the first
      And no duplicate features exist in the database

    Scenario: Re-seed clears stale features
      Given the API server is running
      And a valid API key with scope "admin"
      And the database has a feature for a deleted file
      When I trigger feature re-seed
      Then the stale feature is removed from the database
      And only features matching filesystem files remain

    Scenario: Seed requires admin scope
      Given the API server is running
      And a valid API key with scope "write" but not "admin"
      When I send a POST request to "/api/admin/seed-features"
      Then the response status is 403

    Scenario: Seed reports step counts per version
      Given the API server is running
      And a valid API key with scope "admin"
      When I send a POST request to "/api/admin/seed-features"
      Then the response body has field "step_totals" as an object with:
        | version | total_steps | total_scenarios |
        | mvp     | (integer)   | (integer)       |
        | v1      | (integer)   | (integer)       |
        | v2      | (integer)   | (integer)       |

  # ── Feature File Export ─────────────────────────────────────────────

  Rule: Feature files can be exported back to the filesystem

    Scenario: Export all features to the filesystem
      Given the API server is running
      And a valid API key with scope "admin"
      And features exist in the database for components "comp-a" and "comp-b"
      When I send a POST request to "/api/admin/export-features"
      Then the response status is 200
      And feature files are written to "components/comp-a/features/"
      And feature files are written to "components/comp-b/features/"
      And each file contains the Gherkin content from the database

    Scenario: Export creates component directories if missing
      Given the API server is running
      And a valid API key with scope "admin"
      And a feature exists for component "new-comp" but no directory exists
      When I trigger feature export
      Then the directory "components/new-comp/features/" is created
      And the feature file is written there

    Scenario: Export for a single component
      Given the API server is running
      And a valid API key with scope "admin"
      When I send a POST request to "/api/admin/export-features?component=specific-comp"
      Then the response status is 200
      And only features for "specific-comp" are exported to the filesystem

  # ── Feature Content Search ──────────────────────────────────────────

  Rule: Feature content can be searched across all components

    Scenario: Search features by keyword
      Given the API server is running
      And a valid API key with scope "read"
      And features exist containing the word "authentication"
      When I send a GET request to "/api/features/search?q=authentication"
      Then the response status is 200
      And the response body is an array of matching features
      And each result has fields: node_id, filename, version, title, step_count, snippet

    Scenario: Search with no results returns empty array
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/features/search?q=xyznonexistent"
      Then the response status is 200
      And the response body is an empty array

    Scenario: Search is case-insensitive
      Given the API server is running
      And a valid API key with scope "read"
      And a feature contains "Neo4j"
      When I send a GET request to "/api/features/search?q=neo4j"
      Then the response body contains the matching feature

    Scenario: Search can be scoped to a version
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/features/search?q=test&version=v1"
      Then every result in the response has version "v1"

    Scenario: Search returns snippet with highlighted match
      Given the API server is running
      And a valid API key with scope "read"
      And a feature contains "rate limiting"
      When I send a GET request to "/api/features/search?q=rate+limiting"
      Then each result has a "snippet" field showing context around the match
