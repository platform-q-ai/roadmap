@wip @v2
Feature: Neo4j Schema Initialisation
  As the roadmap application
  I want to initialise Neo4j with constraints and indexes
  So that data integrity is enforced and queries are performant

  Rule: Neo4j schema is initialised with constraints and indexes

    Scenario: Node uniqueness constraint is created
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then a uniqueness constraint exists on Node.id
      And the constraint name is "unique_node_id"

    Scenario: Edge composite uniqueness constraint is created
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then a uniqueness constraint exists on Edge (source_id, target_id, type)
      And duplicate edges are rejected by the database

    Scenario: Version composite uniqueness constraint is created
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then a uniqueness constraint exists on Version (node_id, version)
      And duplicate versions are rejected by the database

    Scenario: Indexes are created for common query patterns
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then an index exists on Node.type
      And an index exists on Node.layer
      And an index exists on Version.node_id
      And an index exists on Feature.node_id
      And an index exists on Feature.version

    Scenario: Schema initialisation is idempotent
      Given a Neo4j database with existing constraints and indexes
      When the schema initialisation runs again
      Then no errors are thrown
      And the constraints remain unchanged
      And the indexes remain unchanged

    Scenario: Full-text index on Node name and description
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then a full-text index exists on Node.name and Node.description
      And the index supports case-insensitive search
