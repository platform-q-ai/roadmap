Feature: Drag and Drop Position Persistence
  As a user viewing the progression tree
  I want dragged component positions to persist after page reload
  So that my custom layout is preserved across sessions

  Background:
    Given components exist in the position database

  Scenario: Saved positions override dagre layout after render
    Given a stored position for "app1" at x 450 and y 300
    When the tree renders and applies saved positions
    Then the rendered position of "app1" should be x 450 and y 300
    And "app1" rendered position should differ from its dagre default

  Scenario: Layout then apply then fit ordering is correct
    Given a stored position for "app1" at x 450 and y 300
    When the tree renders and applies saved positions
    Then the operation log should show layout before apply
    And the operation log should show fit after apply
    And the rendered position of "app1" should be x 450 and y 300

  Scenario: Drag persists position to the repository
    When a drag of "app1" saves position x 500 and y 600 via use case
    Then the repository should have x 500 and y 600 for "app1"

  Scenario: Positions survive a full destroy and re-render cycle
    Given a stored position for "app1" at x 200 and y 350
    When the rendered tree is destroyed and rebuilt
    And the tree renders and applies saved positions
    Then the rendered position of "app1" should be x 200 and y 350

  Scenario: Unsaved components keep dagre defaults
    Given no stored position for "app1"
    When the tree renders and applies saved positions
    Then "app1" rendered position should match its dagre default

  Scenario: Fit does not revert saved positions
    Given a stored position for "app1" at x 450 and y 300
    When the tree renders and applies saved positions
    Then the operation log should show fit after apply
    And the rendered position of "app1" should be x 450 and y 300

  Scenario: Positions are applied synchronously after dagre, not via deferred event
    Given a stored position for "app1" at x 450 and y 300
    When the dagre layout completes synchronously during construction
    And saved positions are applied immediately after construction
    Then the rendered position of "app1" should be x 450 and y 300
    And position application should not depend on a deferred event listener
