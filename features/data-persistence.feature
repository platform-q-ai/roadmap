Feature: Data Persistence
  As the system
  I want SQLite repositories to correctly store and retrieve architecture data
  So that the database layer fulfils the domain contracts

  Background:
    Given a fresh in-memory SQLite database with the schema loaded

  Scenario: Save and retrieve a node
    Given a node with id "test-comp", name "Test Component", and type "component"
    When I save the node via the repository
    And I find the node by id "test-comp"
    Then the retrieved node has name "Test Component"

  Scenario: Find nodes by type
    Given a saved layer node "layer-1"
    And a saved component node "comp-1" in layer "layer-1"
    And a saved component node "comp-2" in layer "layer-1"
    When I find nodes by type "component"
    Then I receive 2 nodes

  Scenario: Find nodes by layer
    Given a saved layer node "layer-1"
    And a saved component node "comp-a" in layer "layer-1"
    And a saved component node "comp-b" in layer "layer-1"
    When I find nodes by layer "layer-1"
    Then I receive 2 nodes

  Scenario: Check node existence
    Given a saved component node "exists-node"
    When I check if node "exists-node" exists
    Then the result is true
    When I check if node "missing-node" exists
    Then the result is false

  Scenario: Delete a node
    Given a saved component node "to-delete"
    When I delete node "to-delete"
    And I find the node by id "to-delete"
    Then the retrieved node is null

  Scenario: Save and retrieve edges
    Given saved nodes "src-node" and "tgt-node"
    And an edge from "src-node" to "tgt-node" of type "CONTROLS"
    When I save the edge via the repository
    And I find edges by source "src-node"
    Then I receive 1 edge with target "tgt-node"

  Scenario: Find relationship edges excluding containment
    Given saved nodes "layer-x" and "comp-x" and "comp-y"
    And a saved "CONTAINS" edge from "layer-x" to "comp-x"
    And a saved "DEPENDS_ON" edge from "comp-x" to "comp-y"
    When I find relationship edges
    Then I receive only the "DEPENDS_ON" edge

  Scenario: Save and retrieve versions
    Given a saved component node "versioned-comp"
    And a version "mvp" for node "versioned-comp" with progress 25 and status "in-progress"
    When I save the version via the repository
    And I find versions by node "versioned-comp"
    Then I receive 1 version with progress 25

  Scenario: Save version with progress
    Given a saved component node "progress-comp"
    And a version "mvp" for node "progress-comp" with progress 75 and status "in-progress"
    When I save the version via the repository
    And I find the version for node "progress-comp" version "mvp"
    Then the version has progress 75 and status "in-progress"

  Scenario: Save and retrieve features
    Given a saved component node "featured-comp"
    And a feature for node "featured-comp" version "mvp" with filename "mvp-test.feature"
    When I save the feature via the repository
    And I find features by node "featured-comp"
    Then I receive 1 feature with filename "mvp-test.feature"

  Scenario: Delete all features for idempotent re-seeding
    Given a saved component node "reseed-comp"
    And 3 saved features for node "reseed-comp"
    When I delete all features
    And I find features by node "reseed-comp"
    Then I receive 0 features
