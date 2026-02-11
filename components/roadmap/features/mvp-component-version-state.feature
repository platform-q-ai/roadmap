Feature: Component Version State
  As a user viewing the roadmap
  I want each component to show its current version as a derived state
  So that I can see at a glance whether a component is Concept, MVP, or a released version

  Background:
    Given an architecture graph with nodes and versions

  # ─── Domain: Node entity gains current_version ───────────

  Scenario: Node with no current_version is Concept
    Given a node with id "future-thing" and no current_version
    Then the node display state should be "Concept"

  Scenario: Node with version less than 1.0.0 is MVP
    Given a node with id "early-thing" and current_version "0.3.0"
    Then the node display state should be "MVP"
    And the node display version should be "0.3.0"

  Scenario: Node with version 1.0.0 or above shows major version
    Given a node with id "shipped-thing" and current_version "1.2.0"
    Then the node display state should be "v1"
    And the node display version should be "1.2.0"

  Scenario: Node with version 2.0.0 shows v2
    Given a node with id "mature-thing" and current_version "2.0.0"
    Then the node display state should be "v2"
    And the node display version should be "2.0.0"

  Scenario: Node type includes app for top-level services
    Given a node with id "my-app" and type "app"
    Then the node type should be "app"
    And the node should be valid

  # ─── Domain: Version entity accepts flexible version tags ─

  Scenario: Version entity accepts arbitrary version strings
    Given a version with version tag "v3"
    Then the version should be valid

  Scenario: Version entity still accepts overview tag
    Given a version with version tag "overview"
    Then the version should be valid

  # ─── Domain: Feature entity accepts flexible version strings ─

  Scenario: Feature derives version from v3 filename prefix
    Given a feature file named "v3-advanced-thing.feature"
    Then the derived version should be "v3"

  Scenario: Feature still derives mvp from unprefixed filename
    Given a feature file named "basic-thing.feature"
    Then the derived version should be "mvp"

  # ─── Use Case: GetArchitecture includes version state ────

  Scenario: Exported architecture includes current_version and display state
    Given a node "roadmap" with current_version "0.7.5" exists in the database
    When I assemble the architecture
    Then the enriched node "roadmap" should have current_version "0.7.5"
    And the enriched node "roadmap" should have display_state "MVP"

  Scenario: Exported architecture includes current_version null for Concept
    Given a node "future-thing" with no current_version exists in the database
    When I assemble the architecture
    Then the enriched node "future-thing" should have display_state "Concept"

  # ─── Schema: node_versions accepts flexible version tags ─

  Scenario: Database accepts version tag beyond mvp/v1/v2
    Given a node "test-node" exists in the database
    When I save a version with tag "v3" for node "test-node"
    Then the version should be persisted successfully

  Scenario: Database stores current_version on nodes
    Given a node "test-node" with current_version "1.0.0" is saved
    When I retrieve the node "test-node"
    Then the node current_version should be "1.0.0"
