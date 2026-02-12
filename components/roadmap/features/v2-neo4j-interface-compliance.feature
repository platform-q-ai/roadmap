@wip @v2
Feature: Neo4j Repository Interface Compliance
  As the roadmap application
  I want Neo4j repositories to implement the same domain interfaces as SQLite
  So that use cases work identically regardless of storage backend

  Rule: Neo4j repositories implement the same domain interfaces as SQLite

    Scenario: Neo4j node repository implements INodeRepository
      Given the Neo4j node repository class
      Then it implements the INodeRepository interface
      And it has methods: findAll, findById, findByType, findByLayer, exists, save, delete

    Scenario: Neo4j edge repository implements IEdgeRepository
      Given the Neo4j edge repository class
      Then it implements the IEdgeRepository interface
      And it has methods: findAll, findBySource, findByTarget, findByType, findRelationships, save, delete

    Scenario: Neo4j version repository implements IVersionRepository
      Given the Neo4j version repository class
      Then it implements the IVersionRepository interface
      And it has methods: findAll, findByNode, findByNodeAndVersion, save, deleteByNode

    Scenario: Neo4j feature repository implements IFeatureRepository
      Given the Neo4j feature repository class
      Then it implements the IFeatureRepository interface
      And it has methods: findAll, findByNode, findByNodeAndVersion, save, deleteAll, deleteByNode

    Scenario: Use cases work identically with Neo4j repositories
      Given the GetArchitecture use case
      When I inject Neo4j repositories instead of SQLite repositories
      Then the use case executes without modification
      And the output structure is identical

    Scenario: Adapter wiring selects storage backend from environment
      Given the environment variable "STORAGE_BACKEND" is set to "neo4j"
      When the API adapter initialises
      Then it creates Neo4j repository instances
      And injects them into use cases

    Scenario: Adapter defaults to SQLite when STORAGE_BACKEND is unset
      Given the environment variable "STORAGE_BACKEND" is not set
      When the API adapter initialises
      Then it creates SQLite/Drizzle repository instances
      And injects them into use cases
