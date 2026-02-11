Feature: Feature Seeding
  As a specification author
  I want feature files on disk to be seeded into the database
  So that Gherkin specs appear alongside their component in the architecture view

  Background:
    Given a database with architecture data

  Scenario: Seed a feature file for an existing component
    Given a component node "sanitiser" exists
    And a feature file "mvp-sanitiser.feature" with content:
      """
      Feature: Sanitiser MVP
        Scenario: Block injection
          Given a response containing role tags
          When the sanitiser processes it
          Then the injection is blocked
      """
    When I seed the feature files
    Then the feature for node "sanitiser" is saved with version "mvp"
    And the feature title is "Sanitiser MVP"

  Scenario: Derive version from filename prefix
    Given a component node "worker" exists
    And a feature file "v1-advanced-tools.feature" with content:
      """
      Feature: Advanced tool support
      """
    When I seed the feature files
    Then the feature is saved with version "v1"

  Scenario: Default to mvp version when no prefix matches
    Given a component node "worker" exists
    And a feature file "basic-execution.feature" with content:
      """
      Feature: Basic execution
      """
    When I seed the feature files
    Then the feature is saved with version "mvp"

  Scenario: Skip feature files for unknown nodes
    Given no node with id "nonexistent" exists
    And a feature file targeting node "nonexistent"
    When I seed the feature files
    Then the feature is skipped
    And the result reports 0 seeded and 1 skipped

  Scenario: Clear existing features before re-seeding
    Given a component node "sanitiser" exists
    And the database already has features for node "sanitiser"
    When I seed the feature files
    Then all previous features are deleted before new ones are inserted

  Scenario: Extract title from Gherkin Feature line
    Given a component node "worker" exists
    And a feature file "mvp-task-execution.feature" with content:
      """
      Feature: Task execution under constraints
        Scenario: Execute with tools
      """
    When I seed the feature files
    Then the feature title is "Task execution under constraints"

  Scenario: Fall back to filename when no Feature line exists
    Given a component node "worker" exists
    And a feature file "mvp-notes.feature" with content:
      """
      Some notes without a Feature line
      """
    When I seed the feature files
    Then the feature title is "mvp-notes"
