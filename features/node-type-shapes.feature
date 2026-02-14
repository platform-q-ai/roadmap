Feature: Node type shapes in progression tree
  As a user viewing the progression tree
  I want different node types to have distinct shapes
  So that I can visually distinguish apps from MCP servers at a glance

  Background:
    Given the architecture data is loaded

  Scenario: App nodes render as octagons
    Given a node with type "app" exists in the progression tree
    When the progression tree is rendered
    Then the node should have shape "octagon"

  Scenario: MCP nodes render as circles
    Given a node with type "mcp" exists in the progression tree
    When the progression tree is rendered
    Then the node should have shape "ellipse"

  Scenario: MCP is a valid node type
    When I create a node with type "mcp"
    Then the node should be created successfully
    And the node type should be "mcp"

  Scenario: MCP nodes appear in the progression tree
    Given a node with type "mcp" exists
    When the architecture graph is assembled
    Then the node should be included in the progression tree nodes

  Scenario: Node type is passed as Cytoscape element data
    Given a node with type "app" exists in the progression tree
    When the progression tree elements are built
    Then the Cytoscape element data should include the node type

  Scenario: Default shape for unrecognised types
    Given a node with an unrecognised type exists in the progression tree
    When the progression tree is rendered
    Then the node should have shape "hexagon"
