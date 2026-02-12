@wip @v1
Feature: API Architecture Graph Endpoint
  As an LLM engineer using the roadmap API headlessly
  I want the architecture endpoint to return the full enriched graph
  So that I can consume the complete system topology in a single request

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
