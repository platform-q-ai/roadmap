Feature: Progression tree design update — hexagonal nodes and full-width layout
  As a user viewing the roadmap progression tree
  I want component nodes rendered as hexagons instead of rectangles
  And the tree to fill the available width without manual zoom controls
  So that the visual design feels polished and the tree is always fully visible

  # ─── Hexagonal node shape ────────────────────────────────────

  Scenario: Progression tree nodes use hexagonal shape
    Given the web view HTML
    Then the cytoscape node shape should be "hexagon" not "roundrectangle"

  Scenario: Hexagonal nodes have adequate dimensions for labels
    Given the web view HTML
    Then the cytoscape node width should be at least 120 pixels
    And the cytoscape node height should be at least 120 pixels

  # ─── Zoom removal ────────────────────────────────────────────

  Scenario: User zooming is disabled on the progression tree
    Given the web view HTML
    Then userZoomingEnabled should be false in the cytoscape config

  Scenario: User panning is disabled on the progression tree
    Given the web view HTML
    Then userPanningEnabled should be false in the cytoscape config

  # ─── Full-width fit ──────────────────────────────────────────

  Scenario: Progression tree fits the container width after rendering
    Given the web view HTML
    Then the cytoscape instance should call fit after layout completes

  Scenario: Progression tree fits after positions are applied
    Given the web view HTML
    Then fit should be called after saved positions are applied in layoutstop
