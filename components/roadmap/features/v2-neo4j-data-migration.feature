@wip @v2
Feature: Neo4j Data Migration
  As the roadmap application
  I want to migrate all data from SQLite to Neo4j
  So that the transition is safe, idempotent, and verifiable

  Rule: SQLite data can be migrated to Neo4j

    Scenario: Migrate all nodes from SQLite to Neo4j
      Given a SQLite database containing 60 nodes
      When the migration tool runs
      Then 60 ArchNode nodes exist in Neo4j
      And each node has all properties preserved

    Scenario: Migrate all edges from SQLite to Neo4j
      Given a SQLite database containing 120 edges
      When the migration tool runs
      Then 120 relationships exist in Neo4j
      And each relationship has the correct type, label, and metadata

    Scenario: Migrate all versions from SQLite to Neo4j
      Given a SQLite database containing 200 versions
      When the migration tool runs
      Then 200 Version nodes exist in Neo4j
      And each version is linked to its parent node

    Scenario: Migrate all features from SQLite to Neo4j
      Given a SQLite database containing 50 features
      When the migration tool runs
      Then 50 Feature nodes exist in Neo4j
      And each feature is linked to its parent node

    Scenario: Migration is idempotent
      Given a SQLite database has been migrated once
      When the migration tool runs again
      Then no duplicate nodes or relationships are created
      And updated properties are reflected in Neo4j

    Scenario: Migration validates data integrity
      Given the migration has completed
      When a validation check compares SQLite and Neo4j
      Then the node count matches
      And the edge count matches
      And the version count matches
      And the feature count matches
      And a sample of 10 nodes have identical properties in both databases

    Scenario: Migration CLI provides progress reporting
      Given a SQLite database with data
      When the migration tool runs in verbose mode
      Then it reports the number of nodes migrated
      And it reports the number of edges migrated
      And it reports the number of versions migrated
      And it reports the number of features migrated
      And it reports the total elapsed time
