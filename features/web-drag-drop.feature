Feature: Drag and Drop Components in Web UI
  As a user
  I want to drag components in the progression tree using my mouse
  So that I can customize the layout interactively

  Scenario: User can drag a component to a new position
    Given the web view is loaded with the progression tree
    And component "worker" is visible in the tree
    When the user drags component "worker" from position (400, 300) to (600, 500)
    Then component "worker" should be at the new position (600, 500)

  Scenario: Component position is saved after drag ends
    Given the web view is loaded with the progression tree
    And component "worker" is at position (400, 300)
    When the user completes dragging "worker" to position (600, 500)
    Then a POST request should be sent to "/api/component-positions" with the new coordinates

  Scenario: Dragging updates node position visually
    Given the web view is loaded with the progression tree
    And component "worker" is at initial position (400, 300)
    When the user drags component "worker" to (600, 500)
    Then the node "worker" should render at screen position (600, 500)

  Scenario: Saved positions are loaded on page refresh
    Given the web view is loaded
    And component "worker" has a saved position of (600, 500)
    When the page loads the progression tree
    Then a GET request should be made to "/api/component-positions"
    And component "worker" should be positioned at (600, 500)

  Scenario: Drag cursor changes on hover
    Given the web view is loaded with the progression tree
    When the user hovers over a draggable component
    Then the cursor should change to "grab"
    When the user starts dragging the component
    Then the cursor should change to "grabbing"

  Scenario: Dragging is disabled during active drag
    Given the web view is loaded with the progression tree
    And the user is currently dragging component "worker"
    When the user attempts to drag another component
    Then the second drag should be ignored

  Scenario: Position is validated before saving
    Given the web view is loaded with the progression tree
    When the user drags a component outside the visible canvas
    Then the position should be clamped to valid coordinates
    And the component should remain within the viewport

  Scenario: Multiple components can be dragged independently
    Given the web view is loaded with the progression tree
    And components "worker" and "supervisor" are visible
    When the user drags "worker" to (200, 200)
    And the user drags "supervisor" to (400, 400)
    Then both components should be at their respective new positions
