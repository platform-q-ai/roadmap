Feature: Roadmap as a Component
  As a developer of the roadmap itself
  I want the roadmap to track itself as a component in the architecture graph
  So that it appears in the progression tree with its own features and version

  # ─── Self-tracking ───────────────────────────────────────

  Scenario: Roadmap exists as an app node
    Given the architecture database is seeded
    When I look up the node "roadmap"
    Then it should exist with type "app"
    And it should have a current_version
    And its display state should be "MVP"

  Scenario: Roadmap has version specs
    Given the architecture database is seeded
    When I retrieve versions for node "roadmap"
    Then there should be an "overview" version
    And there should be an "mvp" version

  # ─── Feature files ──────────────────────────────────────

  Scenario: Roadmap feature files live under components/roadmap/features
    Given feature files exist at "components/roadmap/features/"
    When I seed features into the database
    Then features should be linked to node "roadmap"

  Scenario: Roadmap feature files are versioned correctly
    Given a feature file "mvp-architecture-graph-assembly.feature" under "components/roadmap/features/"
    When I seed features into the database
    Then the feature version should be "mvp"

  # ─── Progression Tree Presence ───────────────────────────

  Scenario: Roadmap appears in the progression tree
    Given the architecture is assembled with progression data
    When I look at the progression tree
    Then "roadmap" should be present as a node
    And it should show its current version

  # ─── App Classification ─────────────────────────────────

  Scenario: Key runtime components are classified as apps
    Given the architecture database is seeded
    Then the following nodes should have type "app":
      | node_id                |
      | roadmap                |
      | supervisor             |
      | meta-agent             |
      | worker                 |
      | state-store            |
      | user-knowledge-graph   |
      | rpg-code-graph         |
      | live-dashboard         |
      | mcp-proxy-meta         |
      | mcp-proxy-worker       |
      | sanitiser              |
      | human-gate             |
      | checkpointer           |
      | context-rebuilder      |

  Scenario: Internal tools and layers remain as non-app types
    Given the architecture database is seeded
    Then node "observability-dashboard" should have type "layer"
    And node "goal-queue" should have type "component"
    And node "phase-feature" should have type "phase"
    And node "tool-search" should have type "external"
