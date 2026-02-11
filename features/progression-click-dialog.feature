Feature: Progression tree click-to-open component dialog
  As a user viewing the progression tree
  I want to click a component node to see its full details in a centered dialog
  So that I can explore version specs and feature files without leaving the graph view

  # ─── Dialog structure ──────────────────────────────────────

  Scenario: Web view contains a dialog overlay container
    Given the web view HTML
    Then it should contain a dialog overlay element with class "dialog-overlay"
    And the dialog overlay should be hidden by default

  Scenario: Dialog has a close button
    Given the web view HTML
    Then the dialog should contain a close button

  # ─── Click replaces hover ──────────────────────────────────

  Scenario: Progression tree uses click events instead of hover for node details
    Given the web view HTML
    Then the cytoscape node event should use "click" not "mouseover"
    And there should be no "mouseover" handler for showing node details

  # ─── Dialog content ───────────────────────────────────────

  Scenario: Dialog renders component name and description
    Given the web view HTML
    Then the dialog render function should display the node name
    And the dialog render function should display the node description

  Scenario: Dialog renders version strip with MVP, v1, v2 tabs
    Given the web view HTML
    Then the dialog render function should include a version strip
    And the version strip should support "mvp" versions
    And the version strip should support "v1" versions
    And the version strip should support "v2" versions

  Scenario: Dialog renders version content when a version tab is selected
    Given the web view HTML
    Then the dialog render function should include version content display

  Scenario: Dialog renders feature files section
    Given the web view HTML
    Then the dialog render function should include a features section

  Scenario: Dialog renders progress badge
    Given the web view HTML
    Then the dialog render function should include a progress badge

  # ─── Dialog dismiss behavior ──────────────────────────────

  Scenario: Dialog can be closed with Escape key
    Given the web view HTML
    Then there should be a keydown listener for "Escape" to close the dialog

  Scenario: Dialog can be closed by clicking the overlay background
    Given the web view HTML
    Then clicking the overlay background should close the dialog
