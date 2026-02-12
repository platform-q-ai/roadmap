@v1
Feature: API Edge Management
  As an LLM engineer using the roadmap API headlessly
  I want endpoints to create, list, filter, and delete edges
  So that I can programmatically build and maintain the dependency graph

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
      And an edge from "list-src" to "list-tgt" with type "DEPENDS_ON" already exists
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
