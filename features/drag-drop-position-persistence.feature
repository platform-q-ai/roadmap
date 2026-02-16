Feature: Drag and Drop Position Persistence
  As a user viewing the progression tree
  I want dragged component positions to persist after page reload
  So that my custom layout is preserved across sessions

  Background:
    Given the system has components with positions in the database

  Scenario: Saved positions are applied after dagre layout completes
    Given component "app1" has a saved position of x 450 and y 300
    When the progression tree renders with dagre layout
    And saved positions are loaded and applied
    Then component "app1" should display at x 450 and y 300
    And component "app1" should not be at its dagre-computed position

  Scenario: Positions load and apply before the tree is considered ready
    Given component "app1" has a saved position of x 450 and y 300
    When the progression tree renders
    Then positions should be applied after layout completes
    And the tree should not revert positions after fitting

  Scenario: Saving a position writes to the repository
    When the user drags component "app1" to position x 500 and y 600
    Then the position repository should contain x 500 and y 600 for "app1"

  Scenario: Positions survive a full reload cycle
    Given component "app1" has a saved position of x 200 and y 350
    When the tree is torn down and re-rendered
    And saved positions are loaded and applied
    Then component "app1" should display at x 200 and y 350

  Scenario: Components without saved positions keep dagre layout
    Given component "app1" has no saved position
    When the progression tree renders with dagre layout
    And saved positions are loaded and applied
    Then component "app1" should remain at its dagre-computed position

  Scenario: cy.fit is called after positions are applied
    Given component "app1" has a saved position of x 450 and y 300
    When the progression tree renders with dagre layout
    And saved positions are loaded and applied
    Then cy.fit should be called after position application
    And component "app1" should still be at the saved coordinates
