Feature: Pre-existing complete components
  As a user viewing the roadmap
  I want the orchestrator and worker components marked as 100% complete pre-existing products
  So that I can see they are already built and available

  Background:
    Given an architecture with orchestration components

  # ─── Seed Data: Orchestrator and workers at v1 ──────────

  Scenario: Orchestrator session has current_version 1.0.0
    Then the seed node "orchestrator-session" should have current_version "1.0.0"

  Scenario: Worker session 1 has current_version 1.0.0
    Then the seed node "worker-session-1" should have current_version "1.0.0"

  Scenario: Worker session 2 has current_version 1.0.0
    Then the seed node "worker-session-2" should have current_version "1.0.0"

  Scenario: Worker session 3 has current_version 1.0.0
    Then the seed node "worker-session-3" should have current_version "1.0.0"

  Scenario: Worker session 4 has current_version 1.0.0
    Then the seed node "worker-session-4" should have current_version "1.0.0"

  # ─── Seed Data: Green color for completed components ────

  Scenario: Orchestrator session has green color
    Then the seed node "orchestrator-session" should have color "green"

  Scenario: Worker sessions have green color
    Then the seed node "worker-session-1" should have color "green"
    And the seed node "worker-session-2" should have color "green"
    And the seed node "worker-session-3" should have color "green"
    And the seed node "worker-session-4" should have color "green"

  # ─── Seed Data: Pre-existing tag ────────────────────────

  Scenario: Orchestrator session is tagged as pre-existing
    Then the seed node "orchestrator-session" should have tag "pre-existing"

  Scenario: Worker sessions are tagged as pre-existing
    Then the seed node "worker-session-1" should have tag "pre-existing"
    And the seed node "worker-session-2" should have tag "pre-existing"
    And the seed node "worker-session-3" should have tag "pre-existing"
    And the seed node "worker-session-4" should have tag "pre-existing"

  # ─── Seed Data: Meta-agent is also tagged pre-existing ──

  Scenario: Meta-agent is tagged as pre-existing
    Then the seed node "meta-agent" should have tag "pre-existing"

  # ─── Domain: Visual state is complete ───────────────────

  Scenario: Orchestrator visual state is complete
    Given a node with current_version "1.0.0" and color "green"
    Then the node visual state should be "complete"

  Scenario: Worker visual state is complete
    Given a node with current_version "1.0.0" and color "green"
    Then the node visual state should be "complete"

  # ─── Seed Data: Version records exist at 100% ──────────

  Scenario: Orchestrator has overview version at 100%
    Then the seed version "overview" for "orchestrator-session" should have progress 100
    And the seed version "overview" for "orchestrator-session" should have status "complete"

  Scenario: Orchestrator has mvp version at 100%
    Then the seed version "mvp" for "orchestrator-session" should have progress 100
    And the seed version "mvp" for "orchestrator-session" should have status "complete"

  Scenario: Worker sessions have overview versions at 100%
    Then the seed version "overview" for "worker-session-1" should have progress 100
    And the seed version "overview" for "worker-session-2" should have progress 100
    And the seed version "overview" for "worker-session-3" should have progress 100
    And the seed version "overview" for "worker-session-4" should have progress 100

  Scenario: Worker sessions have mvp versions at 100%
    Then the seed version "mvp" for "worker-session-1" should have progress 100
    And the seed version "mvp" for "worker-session-2" should have progress 100
    And the seed version "mvp" for "worker-session-3" should have progress 100
    And the seed version "mvp" for "worker-session-4" should have progress 100

  # ─── Web View: Transparent green background ────────────

  Scenario: Progression tree shows complete state with green background
    Then the web view should define complete state color with green border "#34d399"
    And the web view should define complete state with dark green background

  Scenario: Complete nodes have green color class in architecture view
    Given a component with color "green" in the web view
    Then the box should use CSS class "b-green"
    And the green box should have green-tinted title color
