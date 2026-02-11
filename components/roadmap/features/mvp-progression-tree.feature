Feature: Progression Tree
  As a user viewing the roadmap
  I want a game-style progression tree showing apps and their dependencies
  So that I can see what needs to be built to unlock the next app

  Background:
    Given an architecture graph with app-type nodes and dependency edges

  # ─── Data Model: App-type filtering ──────────────────────

  Scenario: Only app-type nodes appear in the progression tree
    Given nodes of types "app", "component", "layer", "external", "phase"
    When I filter for progression tree nodes
    Then only nodes with type "app" should be included

  Scenario: App nodes have dependency edges between them
    Given app node "supervisor" depends on "state-store"
    When I retrieve the dependency graph for apps
    Then there should be a DEPENDS_ON edge from "supervisor" to "state-store"

  # ─── Use Case: GetArchitecture provides progression data ─

  Scenario: Architecture export includes progression tree data
    Given app nodes with DEPENDS_ON edges exist
    When I assemble the architecture
    Then the result should include a progression_tree section
    And the progression_tree should contain only app-type nodes
    And the progression_tree should contain DEPENDS_ON edges between apps

  Scenario: Progression tree nodes include version state
    Given app node "supervisor" with current_version "0.1.0"
    And app node "state-store" with no current_version
    When I assemble the architecture
    Then progression node "supervisor" should have display_state "MVP"
    And progression node "state-store" should have display_state "Concept"

  # ─── Visual States ───────────────────────────────────────

  Scenario: Concept nodes are visually locked
    Given an app node with no current_version
    Then its visual state should be "locked"

  Scenario: MVP nodes are visually in-progress
    Given an app node with current_version "0.2.0"
    Then its visual state should be "in-progress"

  Scenario: Released nodes are visually complete
    Given an app node with current_version "1.0.0"
    Then its visual state should be "complete"

  # ─── Dependency Ordering ─────────────────────────────────

  Scenario: Nodes with no dependencies are root nodes
    Given app node "state-store" with no dependencies
    When I compute the tree layout
    Then "state-store" should be at the top level

  Scenario: Dependent nodes appear below their dependencies
    Given app node "supervisor" depends on "state-store"
    When I compute the tree layout
    Then "supervisor" should appear below "state-store"

  # ─── Tab Structure ───────────────────────────────────────

  Scenario: Web view has two tabs
    Given the web view is loaded
    Then there should be a "Progression" tab
    And there should be an "Architecture" tab
    And the "Progression" tab should be active by default
