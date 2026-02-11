Feature: Architecture Graph Assembly
  As a roadmap consumer
  I want the system to assemble a complete architecture graph
  So that I can see all components, their relationships, versions, and features in one view

  Background:
    Given a database with architecture data

  Scenario: Assemble all nodes into the graph
    Given the database contains nodes of types "layer", "component", and "store"
    When I assemble the architecture graph
    Then every node appears in the result

  Scenario: Group components under their parent layer
    Given a layer node "supervisor-layer"
    And a component node "supervisor" belonging to layer "supervisor-layer"
    When I assemble the architecture graph
    Then the layer "supervisor-layer" contains child "supervisor"

  Scenario: Enrich nodes with their version content
    Given a component node "meta-agent"
    And versions "overview", "mvp", "v1" exist for node "meta-agent"
    When I assemble the architecture graph
    Then node "meta-agent" has version keys "overview", "mvp", "v1"
    And each version includes content, progress, and status

  Scenario: Enrich nodes with their feature specs
    Given a component node "worker"
    And a feature file "mvp-task-execution.feature" for node "worker" version "mvp"
    When I assemble the architecture graph
    Then node "worker" has features under version "mvp"
    And the feature includes filename and title

  Scenario: Exclude containment edges from relationship output
    Given a "CONTAINS" edge from "supervisor-layer" to "supervisor"
    And a "CONTROLS" edge from "supervisor" to "meta-agent"
    When I assemble the architecture graph
    Then the edges list includes the "CONTROLS" edge
    And the edges list does not include the "CONTAINS" edge

  Scenario: Report accurate statistics
    Given the database contains 3 nodes, 2 edges, 4 versions, and 1 feature
    When I assemble the architecture graph
    Then the stats report 3 total nodes
    And the stats report 2 total edges
    And the stats report 4 total versions
    And the stats report 1 total feature

  Scenario: Include a generation timestamp
    When I assemble the architecture graph
    Then the result includes a "generated_at" ISO timestamp
