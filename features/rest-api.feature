Feature: REST API Adapter
  As an LLM-powered CLI coding tool
  I want a REST API to read and manage the architecture graph and feature files
  So that I can traverse the component graph, understand dependencies, and manage feature files programmatically

  # ── Health Check ──────────────────────────────────────────────────

  Scenario: Health endpoint returns server status
    Given the API server is running
    When I send a GET request to "/api/health"
    Then the response status is 200
    And the response body has field "status" with value "ok"

  # ── Architecture Graph ────────────────────────────────────────────

  Scenario: Retrieve full architecture graph
    Given the API server is running
    And the database contains architecture data
    When I send a GET request to "/api/architecture"
    Then the response status is 200
    And the response body has field "layers"
    And the response body has field "nodes"
    And the response body has field "edges"
    And the response body has field "progression_tree"
    And the response body has field "stats"

  # ── Component CRUD ────────────────────────────────────────────────

  Scenario: List all components
    Given the API server is running
    And the database contains architecture data
    When I send a GET request to "/api/components"
    Then the response status is 200
    And the response body is a non-empty array

  Scenario: Get a single component by ID
    Given the API server is running
    And a component "test-comp" exists in the database
    When I send a GET request to "/api/components/test-comp"
    Then the response status is 200
    And the response body has field "id" with value "test-comp"

  Scenario: Get a nonexistent component returns 404
    Given the API server is running
    When I send a GET request to "/api/components/nonexistent-comp"
    Then the response status is 404
    And the response body has field "error"

  Scenario: Create a new component via POST
    Given the API server is running
    When I send a POST request to "/api/components" with body:
      """
      {"id":"new-api-comp","name":"New API Component","type":"component","layer":"supervisor-layer"}
      """
    Then the response status is 201
    And the response body has field "id" with value "new-api-comp"

  Scenario: Create a component with duplicate ID returns 409
    Given the API server is running
    And a component "dup-comp" exists in the database
    When I send a POST request to "/api/components" with body:
      """
      {"id":"dup-comp","name":"Duplicate","type":"app","layer":"supervisor-layer"}
      """
    Then the response status is 409
    And the response body has field "error"

  Scenario: Create a component with invalid type returns 400
    Given the API server is running
    When I send a POST request to "/api/components" with body:
      """
      {"id":"bad-type","name":"Bad","type":"invalid","layer":"supervisor-layer"}
      """
    Then the response status is 400
    And the response body has field "error"

  Scenario: Create a component with missing required fields returns 400
    Given the API server is running
    When I send a POST request to "/api/components" with body:
      """
      {"id":"missing-name"}
      """
    Then the response status is 400
    And the response body has field "error"

  Scenario: Delete a component via DELETE
    Given the API server is running
    And a component "delete-me" exists in the database
    When I send a DELETE request to "/api/components/delete-me"
    Then the response status is 204

  Scenario: Delete a nonexistent component returns 404
    Given the API server is running
    When I send a DELETE request to "/api/components/ghost-comp"
    Then the response status is 404
    And the response body has field "error"

  # ── Feature File Management ───────────────────────────────────────

  Scenario: Get feature files for a component
    Given the API server is running
    And a component "feat-comp" exists in the database
    And the component "feat-comp" has feature files
    When I send a GET request to "/api/components/feat-comp/features"
    Then the response status is 200
    And the response body is a non-empty array

  Scenario: Get feature files for a nonexistent component returns 404
    Given the API server is running
    When I send a GET request to "/api/components/nonexistent-feat/features"
    Then the response status is 404
    And the response body has field "error"

  Scenario: Upload a feature file for a component
    Given the API server is running
    And a component "upload-comp" exists in the database
    When I send a PUT request to "/api/components/upload-comp/versions/mvp/features/mvp-test.feature" with body:
      """
      Feature: Test Upload
        Scenario: A test scenario
          Given something
          Then something happens
      """
    Then the response status is 200
    And the response body has field "filename" with value "mvp-test.feature"

  Scenario: Upload a feature file for a nonexistent component returns 404
    Given the API server is running
    When I send a PUT request to "/api/components/ghost-upload/versions/mvp/features/mvp-test.feature" with body:
      """
      Feature: Ghost Upload
        Scenario: A test
          Given something
      """
    Then the response status is 404
    And the response body has field "error"

  # ── Graph Traversal ───────────────────────────────────────────────

  Scenario: Get edges for a component (dependencies and dependents)
    Given the API server is running
    And a component "graph-comp" exists in the database
    And the component "graph-comp" has edges
    When I send a GET request to "/api/components/graph-comp/edges"
    Then the response status is 200
    And the response body has field "inbound"
    And the response body has field "outbound"

  Scenario: Get dependency tree for a component
    Given the API server is running
    And a component "dep-comp" exists in the database
    When I send a GET request to "/api/components/dep-comp/dependencies"
    Then the response status is 200
    And the response body has field "dependencies"

  # ── API Server Configuration ──────────────────────────────────────

  Scenario: API adapter script exists
    Given the project source directory
    Then a file "src/adapters/api/server.ts" exists in the project
    And a file "src/adapters/api/routes.ts" exists in the project
    And a file "src/adapters/api/index.ts" exists in the project
