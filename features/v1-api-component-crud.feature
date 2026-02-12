@wip @v1
Feature: API Component CRUD
  As an LLM engineer using the roadmap API headlessly
  I want comprehensive endpoints to create, read, and delete components
  So that I can programmatically build the architecture graph

  The MVP API provides basic CRUD for components. V1 extends this with
  full field support, type validation, and structured error responses.
  All endpoints require appropriate API key scopes (see v1-secure-api.feature).

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
