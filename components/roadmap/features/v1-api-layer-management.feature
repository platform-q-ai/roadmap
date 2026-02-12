@wip @v1
Feature: API Layer Management
  As an LLM engineer using the roadmap API headlessly
  I want endpoints to manage layers and move components between them
  So that I can organise the architecture graph by layer

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
