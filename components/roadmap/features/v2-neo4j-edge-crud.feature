@wip @v2
Feature: Neo4j Edge CRUD
  As the roadmap application
  I want to create, read, update, and delete edges as Neo4j relationships
  So that the edge repository contract is fulfilled by the graph database

  Rule: Neo4j edge repository implements IEdgeRepository

    Scenario: Save a new edge as a Neo4j relationship
      Given nodes "source-1" and "target-1" exist in Neo4j
      When I save an edge from "source-1" to "target-1" with type "DEPENDS_ON"
      Then a Neo4j relationship of type "DEPENDS_ON" exists from "source-1" to "target-1"

    Scenario: Save an edge with label and metadata
      Given nodes "src" and "tgt" exist in Neo4j
      When I save an edge from "src" to "tgt" with:
        | field    | value                 |
        | type     | CONTROLS              |
        | label    | spawns                |
        | metadata | {"priority":"high"}   |
      Then the relationship has property "label" with value "spawns"
      And the relationship has property "metadata" with value '{"priority":"high"}'

    Scenario: Edge upsert updates label and metadata
      Given an edge from "a" to "b" with type "DEPENDS_ON" and label "old"
      When I save an edge from "a" to "b" with type "DEPENDS_ON" and label "new"
      Then only one "DEPENDS_ON" relationship exists from "a" to "b"
      And the label is "new"

    Scenario: Find all edges
      Given 5 edges exist in Neo4j
      When I call findAll on the edge repository
      Then the result contains 5 edges

    Scenario: Find edges by source
      Given edges from "hub" to "spoke-1", "spoke-2", "spoke-3" exist
      When I call findBySource with "hub"
      Then the result contains 3 edges
      And all edges have source_id "hub"

    Scenario: Find edges by target
      Given edges from "a" to "hub" and "b" to "hub" exist
      When I call findByTarget with "hub"
      Then the result contains 2 edges
      And all edges have target_id "hub"

    Scenario: Find edges by type
      Given 2 "CONTAINS" and 3 "DEPENDS_ON" edges exist
      When I call findByType with "CONTAINS"
      Then the result contains 2 edges

    Scenario: Find relationships excludes CONTAINS edges
      Given 2 "CONTAINS" and 3 "DEPENDS_ON" edges exist
      When I call findRelationships
      Then the result contains 3 edges
      And no edge has type "CONTAINS"

    Scenario: Delete an edge by ID
      Given an edge with known ID exists in Neo4j
      When I call delete with that edge ID
      Then the edge no longer exists

    Scenario: All 11 edge types are supported
      Given nodes "edge-src" and "edge-tgt" exist in Neo4j
      When I save edges with each of these types:
        | type           |
        | CONTAINS       |
        | CONTROLS       |
        | DEPENDS_ON     |
        | READS_FROM     |
        | WRITES_TO      |
        | DISPATCHES_TO  |
        | ESCALATES_TO   |
        | PROXIES        |
        | SANITISES      |
        | GATES          |
        | SEQUENCE       |
      Then 11 relationships exist from "edge-src" to "edge-tgt"
