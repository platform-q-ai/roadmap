Feature: Progression tree design update — circular icons and navigation controls
  As a user viewing the roadmap progression tree
  I want component nodes rendered as circular skill icons instead of hexagons
  And navigation controls enabled to explore the complex tree
  So that the visual design feels immersive and navigation is intuitive

  # ─── Circular node shape ────────────────────────────────────

  Scenario: Progression tree nodes use circular shape
    Given the web view HTML
    Then the cytoscape node shape should be "circle" not "roundrectangle"

  # ─── Navigation controls ─────────────────────────────────────

  Scenario: User zooming is enabled on the progression tree
    Given the web view HTML
    Then userZoomingEnabled should be true in the cytoscape config

  Scenario: User panning is enabled on the progression tree
    Given the web view HTML
    Then userPanningEnabled should be true in the cytoscape config

  # ─── Full-width fit ──────────────────────────────────────────

  Scenario: Progression tree fits the container width after rendering
    Given the web view HTML
    Then the cytoscape instance should call fit after layout completes

  Scenario: Progression tree re-fits on window resize
    Given the web view HTML
    Then there should be a resize listener that calls fit on the cytoscape instance
