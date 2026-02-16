Feature: Component positions table created at startup
  As a user of the web view
  I want the component_positions table to be created automatically when the server starts
  So that drag-and-drop position persistence works without manual database setup

  Background:
    Given a fresh database connection with schema applied

  Scenario: component_positions table exists after schema application
    Then the component_positions table should exist

  Scenario: component_positions table has correct columns
    Then the component_positions table should have columns:
      | column       | type |
      | component_id | TEXT |
      | x            | REAL |
      | y            | REAL |
      | updated_at   | TEXT |

  Scenario: component_positions table supports CRUD operations
    Given a node "test-app" exists for position testing
    When I insert a position for "test-app" at x 150.5 and y 300.0
    Then I can retrieve the position for "test-app"
    And the retrieved position has x 150.5 and y 300.0

  Scenario: component_positions cascades on node deletion
    Given a node "ephemeral" exists for position testing
    And a saved position for "ephemeral" at x 100 and y 200
    When I delete the node "ephemeral"
    Then the position for "ephemeral" should not exist

  Scenario: applySchema is idempotent for component_positions
    When applySchema is called a second time on the same database
    Then no error is raised
    And the component_positions table should exist
