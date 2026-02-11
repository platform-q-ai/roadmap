Feature: Architecture Export
  As a web view consumer
  I want to export the architecture graph to a JSON file
  So that the static web page can render it without a database connection

  Background:
    Given a database with architecture data

  Scenario: Export produces a JSON file at the specified path
    Given an output path "web/data.json"
    When I export the architecture
    Then the write function is called with path "web/data.json"
    And the written data contains a "generated_at" field

  Scenario: Export returns statistics about the exported data
    Given the database contains 3 nodes, 2 edges, 4 versions, and 1 feature
    When I export the architecture
    Then the export result includes stats with total counts

  Scenario: Exported data contains the full architecture structure
    Given the database contains nodes with versions and features
    When I export the architecture
    Then the written data includes layers with children
    And the written data includes enriched nodes
    And the written data includes relationship edges
