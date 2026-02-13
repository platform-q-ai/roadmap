Feature: Skill Tree Design
  As a user viewing the roadmap
  I want the progression tree to look like a game skill tree (Assassin's Creed style)
  So that the build progress feels like an immersive progression system

  Background:
    Given the web view is loaded
    And architecture data with app nodes exists

  Scenario: Skill tree branches have labels
    Then there should be a branch label "JAGER"
    And there should be a branch label "KRIJGER"
    And there should be a branch label "ZIENER"

  Scenario: Skill tree has category counters
    Then the "JAGER" branch should have a counter
    And the "KRIJGER" branch should have a counter
    And the "ZIENER" branch should have a counter

  Scenario: Skill tree has an overall points counter
    Then there should be a counter for "VAARDIGHEIDSPUNTEN"
    And it should display the total count of components

  Scenario: Skill tree has Senu's Perceptie counter
    Then there should be a counter for "SENU'S PERCEPTIE"
    And it should display the synchronization percentage

  Scenario: Progression tree uses rectilinear edges
    When I view the progression tree
    Then the edges should have a "taxi" or "segment" curve style
    And the edges should be dark with high contrast

  Scenario: Progression tree nodes use circular skill icons
    When I view the progression tree
    Then the nodes should have a circular or thick-bordered circular shape
    And active nodes should have a glowing effect
    And locked nodes should be desaturated
