Feature: Version-Derived Progress
  As a project manager
  I want each version phase (MVP, v1, v2) to derive its progress from the component's current_version number
  So that version numbers are the single source of truth for build progress

  The mapping rule is:
    - major 0 = MVP phase, minor digit * 10 = MVP progress %
    - major 1 = v1 phase, minor digit * 10 = v1 progress %
    - major 2 = v2 phase, minor digit * 10 = v2 progress %
    - Once a phase's major version is reached, that phase is 100%
    - Phases beyond the current major are 0%
    - No current_version means all phases are 0%

  Examples:
    current_version 0.5.0 -> MVP 50%, v1 0%, v2 0%
    current_version 1.0.0 -> MVP 100%, v1 0%, v2 0%
    current_version 1.3.0 -> MVP 100%, v1 30%, v2 0%
    current_version 2.7.0 -> MVP 100%, v1 100%, v2 70%
    current_version 3.0.0 -> MVP 100%, v1 100%, v2 100%

  Rule: Domain — Version entity derives progress from current_version

    Scenario: Derive MVP progress from pre-1.0 current_version
      Given a node with current_version "0.5.0"
      When I derive phase progress for version "mvp"
      Then the derived progress should be 50

    Scenario: Derive MVP progress at zero
      Given a node with current_version "0.0.0"
      When I derive phase progress for version "mvp"
      Then the derived progress should be 0

    Scenario: MVP is 100% once major version reaches 1
      Given a node with current_version "1.0.0"
      When I derive phase progress for version "mvp"
      Then the derived progress should be 100

    Scenario: MVP stays 100% for higher major versions
      Given a node with current_version "2.3.0"
      When I derive phase progress for version "mvp"
      Then the derived progress should be 100

    Scenario: Derive v1 progress from major version 1
      Given a node with current_version "1.3.0"
      When I derive phase progress for version "v1"
      Then the derived progress should be 30

    Scenario: v1 is 0% when still in MVP phase
      Given a node with current_version "0.8.0"
      When I derive phase progress for version "v1"
      Then the derived progress should be 0

    Scenario: v1 is 100% once major version reaches 2
      Given a node with current_version "2.0.0"
      When I derive phase progress for version "v1"
      Then the derived progress should be 100

    Scenario: Derive v2 progress from major version 2
      Given a node with current_version "2.7.0"
      When I derive phase progress for version "v2"
      Then the derived progress should be 70

    Scenario: v2 is 0% when still in v1 phase
      Given a node with current_version "1.5.0"
      When I derive phase progress for version "v2"
      Then the derived progress should be 0

    Scenario: v2 is 100% once major version reaches 3
      Given a node with current_version "3.0.0"
      When I derive phase progress for version "v2"
      Then the derived progress should be 100

    Scenario: All phases are 0% when no current_version
      Given a node with no current_version
      When I derive phase progress for version "mvp"
      Then the derived progress should be 0
      When I derive phase progress for version "v1"
      Then the derived progress should be 0
      When I derive phase progress for version "v2"
      Then the derived progress should be 0

    Scenario: Derive status from progress value
      Given a node with current_version "0.5.0"
      When I derive phase progress for version "mvp"
      Then the derived progress should be 50
      And the derived status should be "in-progress"

    Scenario: Status is planned when progress is 0
      Given a node with current_version "0.0.0"
      When I derive phase progress for version "mvp"
      Then the derived progress should be 0
      And the derived status should be "planned"

    Scenario: Status is complete when progress is 100
      Given a node with current_version "1.0.0"
      When I derive phase progress for version "mvp"
      Then the derived progress should be 100
      And the derived status should be "complete"

    Scenario: Minor digit 9 gives 90%
      Given a node with current_version "0.9.0"
      When I derive phase progress for version "mvp"
      Then the derived progress should be 90

    Scenario: Overview version is unaffected by derivation
      Given a node with current_version "1.5.0"
      When I derive phase progress for version "overview"
      Then the derived progress should be 0

  Rule: Use Case — GetArchitecture uses derived progress

    Background:
      Given an architecture graph with nodes and versions

    Scenario: Exported architecture uses derived progress for MVP
      Given a node "test-comp" with current_version "0.7.0" exists in the database
      And a version "mvp" with manual progress 20 exists for "test-comp"
      When I assemble the architecture
      Then the version "mvp" for node "test-comp" should have progress 70

    Scenario: Exported architecture uses derived progress for v1
      Given a node "test-comp" with current_version "1.4.0" exists in the database
      And a version "v1" with manual progress 0 exists for "test-comp"
      When I assemble the architecture
      Then the version "v1" for node "test-comp" should have progress 40

    Scenario: Exported architecture derives status from progress
      Given a node "test-comp" with current_version "1.0.0" exists in the database
      And a version "mvp" with manual progress 0 exists for "test-comp"
      When I assemble the architecture
      Then the version "mvp" for node "test-comp" should have progress 100
      And the version "mvp" for node "test-comp" should have status "complete"

    Scenario: Node without current_version keeps manual progress
      Given a node "manual-comp" with no current_version exists in the database
      And a version "mvp" with manual progress 40 exists for "manual-comp"
      When I assemble the architecture
      Then the version "mvp" for node "manual-comp" should have progress 40
