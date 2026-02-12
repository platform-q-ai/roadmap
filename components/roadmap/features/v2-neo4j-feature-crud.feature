@wip @v2
Feature: Neo4j Feature CRUD
  As the roadmap application
  I want to create, read, and delete feature records in Neo4j
  So that the feature repository contract is fulfilled by the graph database

  Rule: Neo4j feature repository implements IFeatureRepository

    Scenario: Save a new feature
      Given a node "feat-node" exists in Neo4j
      When I save a feature for "feat-node" with filename "mvp-test.feature"
      Then a Neo4j node labelled "Feature" exists linked to "feat-node"
      And the feature has filename "mvp-test.feature"

    Scenario: Find all features
      Given features exist for multiple nodes and versions
      When I call findAll on the feature repository
      Then the result contains all features ordered by node_id, version, filename

    Scenario: Find features by node
      Given node "feat-multi" has 3 feature files
      When I call findByNode with "feat-multi"
      Then the result contains 3 features

    Scenario: Find features by node and version
      Given node "feat-ver" has 2 "mvp" features and 1 "v1" feature
      When I call findByNodeAndVersion with "feat-ver" and "mvp"
      Then the result contains 2 features
      And both features have version "mvp"

    Scenario: Delete all features (re-seed preparation)
      Given features exist across multiple nodes
      When I call deleteAll on the feature repository
      Then no features exist in the database

    Scenario: Delete features by node
      Given node "feat-del" has features and node "feat-keep" has features
      When I call deleteByNode with "feat-del"
      Then no features exist for "feat-del"
      And features still exist for "feat-keep"
