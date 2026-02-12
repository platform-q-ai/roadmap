@v1
Feature: API Bulk Operations
  As an LLM engineer using the roadmap API headlessly
  I want bulk mutation endpoints for components and edges
  So that I can efficiently batch-create or batch-delete resources

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
