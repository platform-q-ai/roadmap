@v1
Feature: API Layer Management
  As an LLM engineer using the roadmap API headlessly
  I want endpoints to manage layers and move components between them
  So that I can organise the architecture graph by layer

  Rule: Layers can be listed and inspected

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
      And layer "supervisor-layer" contains components "child-a" and "child-b"
      When I send a GET request to "/api/layers/supervisor-layer"
      Then the response status is 200
      And the response body has field "id" with value "supervisor-layer"
      And the response body has field "children" as an array of 2 items

    Scenario: Get a non-existent layer returns 404
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/layers/no-such-layer"
      Then the response status is 404
      And the response body has field "error" containing "not found"

  Rule: Layers can be created via the API

    Scenario: Create a new layer with required fields
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/layers" with body:
        """
        {"id":"new-layer","name":"New Layer"}
        """
      Then the response status is 201
      And the response body has field "id" with value "new-layer"
      And the response body has field "type" with value "layer"

    Scenario: Create a new layer with all optional fields
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/layers" with body:
        """
        {"id":"full-layer","name":"Full Layer","color":"#E74C3C","icon":"layers","description":"A layer","sort_order":42}
        """
      Then the response status is 201
      And the response body has field "id" with value "full-layer"
      And the response body has field "color" with value "#E74C3C"
      And the response body has field "description" with value "A layer"

    Scenario: Creating a duplicate layer returns 409
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/layers" with body:
        """
        {"id":"supervisor-layer","name":"Duplicate"}
        """
      Then the response status is 409
      And the response body has field "error" containing "already exists"

    Scenario: Creating a layer with missing name returns 400
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/layers" with body:
        """
        {"id":"bad-layer"}
        """
      Then the response status is 400

    Scenario: Creating a layer with invalid id format returns 400
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/layers" with body:
        """
        {"id":"Bad Layer!","name":"Invalid ID"}
        """
      Then the response status is 400

  Rule: Components can be moved between layers

    Scenario: Move a component to a different layer
      Given the API server is running
      And a valid API key with scope "write"
      And component "movable-comp" is in layer "supervisor-layer"
      And layer "target-layer" exists
      When I send a PATCH request to "/api/components/movable-comp" with body:
        """
        {"layer":"target-layer"}
        """
      Then the response status is 200
      And the response body has field "layer" with value "target-layer"
      And the CONTAINS edge from "supervisor-layer" to "movable-comp" is removed
      And a CONTAINS edge from "target-layer" to "movable-comp" exists

    Scenario: Moving to a non-existent layer returns 400
      Given the API server is running
      And a valid API key with scope "write"
      And component "stuck-comp" is in layer "supervisor-layer"
      When I send a PATCH request to "/api/components/stuck-comp" with body:
        """
        {"layer":"ghost-layer"}
        """
      Then the response status is 400
      And the response body has field "error" containing "layer"

    Scenario: Moving to the same layer is a no-op success
      Given the API server is running
      And a valid API key with scope "write"
      And component "same-layer-comp" is in layer "supervisor-layer"
      When I send a PATCH request to "/api/components/same-layer-comp" with body:
        """
        {"layer":"supervisor-layer"}
        """
      Then the response status is 200
      And the response body has field "layer" with value "supervisor-layer"
