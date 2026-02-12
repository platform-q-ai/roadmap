@wip @v1
Feature: API Component Listing and Filtering
  As an LLM engineer using the roadmap API headlessly
  I want to list and filter components by type, layer, tag, and search term
  So that I can find relevant components programmatically

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
