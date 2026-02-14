Feature: Markdown Description Support
  As a roadmap viewer
  I want component descriptions to support Markdown formatting
  So that descriptions are more readable with structured content

  Background:
    Given the API server is running

  Scenario: Markdown syntax survives component creation
    When I send a POST request to "/api/components" with body:
      """
      {
        "id": "md-comp",
        "name": "Markdown Component",
        "type": "component",
        "layer": "supervisor-layer",
        "description": "# Title\n\n**Bold text** and *italic*\n\n- Item one\n- Item two"
      }
      """
    Then the response status is 201
    And the response body field "description" contains "# Title"
    And the response body field "description" contains "**Bold text**"
    And the response body field "description" contains "- Item one"

  Scenario: Markdown syntax survives PATCH update
    Given a component "md-patch" exists in the database
    When I send a PATCH request to "/api/components/md-patch" with body:
      """
      {
        "description": "## Updated\n\n1. First\n2. Second\n\n> Blockquote"
      }
      """
    Then the response status is 200
    And the response body field "description" contains "## Updated"
    And the response body field "description" contains "1. First"
    And the response body field "description" contains "> Blockquote"

  Scenario: HTML tags are stripped but Markdown preserved
    Given a component "md-xss" exists in the database
    When I send a PATCH request to "/api/components/md-xss" with body:
      """
      {
        "description": "<script>alert('xss')</script>Safe **bold** text"
      }
      """
    Then the response status is 200
    And the response body field "description" does not contain "<script>"
    And the response body field "description" contains "**bold**"

  Scenario: Architecture endpoint returns Markdown descriptions unchanged
    Given a component "md-arch" exists in the database with description "**Important** component with `code`"
    When I send a GET request to "/api/architecture"
    Then the response status is 200
    And the architecture response contains a node with description containing "**Important**"
    And the architecture response contains a node with description containing "`code`"
