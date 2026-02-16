Feature: Drag and Drop Components in Progression Tree
  As a user
  I want to drag components in the progression tree to new positions
  So that I can customize the layout and have it persist across sessions

  Scenario: User drags a component to a new position
    Given the progression tree is loaded with components
    And component "app1" is at position x 100 and y 200
    When the user drags component "app1" to position x 300 and y 400
    Then component "app1" should be at position x 300 and y 400

  Scenario: Component position persists after save
    Given the progression tree is loaded with components
    When the user drags component "app1" to position x 300 and y 400
    And the user saves the layout
    Then the position for component "app1" should be stored in the database

  Scenario: Component position is restored on page reload
    Given the progression tree is loaded with components
    And component "app1" has a stored position of x 300 and y 400
    When the user reloads the page
    Then component "app1" should be at position x 300 and y 400

  Scenario: Multiple components can have custom positions
    Given the progression tree is loaded with components
    When the user drags component "app1" to position x 100 and y 100
    And the user drags component "app2" to position x 200 and y 200
    And the user saves the layout
    Then component "app1" should be at position x 100 and y 100
    And component "app2" should be at position x 200 and y 200

  Scenario: Component without custom position uses default layout
    Given the progression tree is loaded with components
    And component "app1" has no stored position
    When the progression tree is rendered
    Then component "app1" should use the default dagre layout position

  Scenario: User can reset component to default position
    Given the progression tree is loaded with components
    And component "app1" has a stored position of x 300 and y 400
    When the user resets component "app1" position
    Then component "app1" should use the default dagre layout position
    And the stored position for component "app1" should be removed

  Scenario: Invalid positions are rejected
    Given the progression tree is loaded with components
    When the user attempts to save invalid position for component "app1"
    Then the system should reject the invalid position
    And component "app1" should retain its previous position

  Scenario: Positions persist across server restarts
    Given the progression tree is loaded with components
    And component "app1" has been dragged to position x 300 and y 400
    And the user has saved the layout
    When the server restarts
    And the user reloads the page
    Then component "app1" should be at position x 300 and y 400

  Scenario: API endpoint returns all component positions
    Given the progression tree has custom positions saved
    When the API endpoint "GET /api/component-positions" is called
    Then the response should contain all component positions
    And each position should include component_id, x, and y coordinates

  Scenario: API endpoint saves component position
    Given a component "app1" exists in the system
    When the API endpoint "POST /api/component-positions" is called with position x 300 and y 400 for "app1"
    Then the position should be saved in the database
    And the response should return the saved position

  Scenario: API endpoint deletes component position
    Given component "app1" has a stored position of x 300 and y 400
    When the API endpoint "DELETE /api/component-positions/app1" is called
    Then the position for component "app1" should be removed
    And subsequent GET requests should return 404 for "app1"
