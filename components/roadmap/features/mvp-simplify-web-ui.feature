Feature: Simplify web UI — remove architecture tab and clean up header
  As a user viewing the roadmap
  I want the architecture tab removed and the header simplified
  So that the UI is cleaner and focused on the progression tree

  Background:
    Given the web view HTML

  # ─── Remove Architecture Tab ─────────────────────────────

  Scenario: Architecture tab button is removed
    Then the HTML should not contain a tab button with text "Architecture"

  Scenario: Architecture tab content container is removed
    Then the HTML should not contain an element with id "tab-architecture"

  Scenario: Architecture render function is removed
    Then the HTML should not contain a function named "render" that targets the "architecture" element

  Scenario: switchTab function is removed
    Then the HTML should not contain a function named "switchTab"

  Scenario: Tab bar container is removed
    Then the HTML should not contain a tabs container with class "tabs"

  Scenario: Progression content is always visible
    Then the progression container should not require tab activation
    And the progression container should be in a div with class "tab-content active" or have no tab-content wrapper

  # ─── Rename Progression Tab ──────────────────────────────

  Scenario: Tab label renamed to Progression System Overview
    Then the HTML should not contain the text "Progression" as a standalone tab label
    And the progression tree section should exist without tab switching

  # ─── Remove Stats Bar ───────────────────────────────────

  Scenario: Stats bar element is removed
    Then the HTML should not contain an element with id "stats-bar"

  Scenario: renderStats function is removed
    Then the HTML should not contain a function named "renderStats"

  # ─── Remove Badges ──────────────────────────────────────

  Scenario: Tags row badges are removed from the header
    Then the HTML should not contain a tags-row div in the header

  Scenario: Living Documentation badge is removed
    Then the HTML should not contain a badge div with text "Living Documentation"

  # ─── Update Version ─────────────────────────────────────

  Scenario: Header version is v0.3
    Then the header h1 should contain version text "v0.3"
    And the header h1 should not contain version text "v3.2"
