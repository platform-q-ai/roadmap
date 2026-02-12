Feature: API Version-Scoped Feature Upload
  As an LLM engineer working autonomously
  I want to upload Gherkin feature files with an explicit version in the URL path
  So that every feature is categorised under a version tier (mvp, v1, v2)
  and the system can calculate step-level completion rates

  The MVP API supports basic feature upload with version derived from filename.
  V1 makes version a mandatory part of the upload URL path, ensuring every
  feature file is explicitly categorised under a version (mvp, v1, v2, etc.).

  Rule: Feature uploads require an explicit version in the URL path

    Scenario: Upload a feature file with explicit version in path
      Given the API server is running
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
      And a component "bad-ver" exists
      When I send a PUT request to "/api/components/bad-ver/versions/invalid/features/test.feature" with Gherkin content
      Then the response status is 400
      And the response body has field "error" containing "version"

    Scenario: Reject upload without version in path (old MVP-style URL)
      Given the API server is running
      When I send a PUT request to "/api/components/some-comp/features/test.feature" with Gherkin content
      Then the response status is 400
      And the response body has field "error" containing "version is required"

    Scenario: Upload extracts title from Feature: line
      Given the API server is running
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
      And a component "multi-ver" exists
      When I upload "auth.feature" to "multi-ver" under version "mvp" with 3 steps
      And I upload "auth.feature" to "multi-ver" under version "v1" with 8 steps
      Then 2 feature records exist for "multi-ver" with filename "auth.feature"
      And the "mvp" version has step_count 3
      And the "v1" version has step_count 8

    Scenario: Upload preserves features under other versions
      Given the API server is running
      And component "preserve-comp" has features under versions "mvp" and "v1"
      When I upload a new feature under version "v2"
      Then the "mvp" and "v1" features are unchanged
      And "preserve-comp" now has features across 3 versions

    Scenario: Response includes step count breakdown
      Given the API server is running
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
