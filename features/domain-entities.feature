Feature: Domain Entities
  As a developer
  I want well-defined domain entities with consistent behavior
  So that the data model is reliable across all layers

  Scenario: Create a Node with required fields
    Given node properties with id "test-node", name "Test Node", and type "component"
    When I create the Node entity
    Then the node has id "test-node"
    And the node has name "Test Node"
    And the node has type "component"

  Scenario: Node parses tags from a JSON string
    Given node properties with tags stored as JSON
    When I create the Node entity
    Then the node has parsed tags "runtime" and "core"

  Scenario: Node accepts tags as an array
    Given node properties with tags provided as array
    When I create the Node entity
    Then the node has parsed tags "alpha" and "beta"

  Scenario: Node defaults optional fields to null or zero
    Given node properties with only required fields
    When I create the Node entity
    Then the node layer is null
    And the node color is null
    And the node icon is null
    And the node description is null
    And the node tags are an empty array
    And the node sort_order is 0

  Scenario: Node identifies itself as a layer
    Given node properties with type "layer"
    When I create the Node entity
    Then the node reports it is a layer

  Scenario: Create an Edge with required fields
    Given edge properties with source "a", target "b", and type "CONTROLS"
    When I create the Edge entity
    Then the edge has source_id "a" and target_id "b"
    And the edge has type "CONTROLS"

  Scenario: Edge identifies containment relationships
    Given edge properties with type "CONTAINS"
    When I create the Edge entity
    Then the edge reports it is a containment edge

  Scenario: Edge identifies non-containment relationships
    Given edge properties with type "DEPENDS_ON"
    When I create the Edge entity
    Then the edge reports it is not a containment edge

  Scenario: Create a Version with defaults
    Given version properties with node_id "comp-1" and version "mvp"
    When I create the Version entity
    Then the version progress is 0
    And the version status is "planned"
    And the version content is null

  Scenario: Version identifies its status
    Given a version with status "complete"
    When I check the version status
    Then isComplete returns true
    And isInProgress returns false

  Scenario: Version identifies in-progress status
    Given a version with status "in-progress"
    When I check the version status
    Then isInProgress returns true
    And isComplete returns false

  Scenario: Feature derives version from filename prefix
    Then version for filename "mvp-basic.feature" is "mvp"
    And version for filename "v1-advanced.feature" is "v1"
    And version for filename "v2-future.feature" is "v2"
    And version for filename "other.feature" is "mvp"

  Scenario: Feature extracts title from Gherkin content
    Then the title extracted from a Feature line is "My Cool Feature"
    And the title falls back to filename "fallback.feature" giving "fallback"
