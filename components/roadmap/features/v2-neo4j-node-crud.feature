@wip @v2
Feature: Neo4j Node CRUD
  As the roadmap application
  I want to create, read, update, and delete architecture nodes in Neo4j
  So that the node repository contract is fulfilled by the graph database

  Rule: Neo4j node repository implements INodeRepository

    Scenario: Save a new node
      Given an empty Neo4j database with schema
      When I save a node with id "test-comp", name "Test Component", type "component"
      Then a Neo4j node labelled "ArchNode" exists with id "test-comp"
      And the node has property "name" with value "Test Component"
      And the node has property "type" with value "component"

    Scenario: Save a node with all optional fields
      Given an empty Neo4j database with schema
      When I save a node with:
        | field           | value                     |
        | id              | full-comp                 |
        | name            | Full Component            |
        | type            | component                 |
        | layer           | supervisor-layer          |
        | color           | #FF5733                   |
        | icon            | server                    |
        | description     | A fully specified node    |
        | tags            | ["runtime","core"]        |
        | sort_order      | 10                        |
        | current_version | 0.5.0                     |
      Then the Neo4j node "full-comp" has all specified properties

    Scenario: Update an existing node via upsert
      Given a node "upsert-comp" exists in Neo4j with name "Original"
      When I save a node with id "upsert-comp" and name "Updated"
      Then the Neo4j node "upsert-comp" has property "name" with value "Updated"
      And only one node with id "upsert-comp" exists

    Scenario: Find all nodes ordered by sort_order
      Given these nodes exist in Neo4j:
        | id   | name   | type      | sort_order |
        | b    | Beta   | component | 20         |
        | a    | Alpha  | component | 10         |
        | c    | Gamma  | component | 30         |
      When I call findAll on the node repository
      Then the result contains 3 nodes
      And the nodes are ordered ["a", "b", "c"]

    Scenario: Find node by ID
      Given a node "find-me" exists in Neo4j
      When I call findById with "find-me"
      Then the result is the node with id "find-me"

    Scenario: Find node by ID returns null when not found
      When I call findById with "nonexistent"
      Then the result is null

    Scenario: Find nodes by type
      Given these nodes exist in Neo4j:
        | id      | name      | type      |
        | layer-1 | Layer One | layer     |
        | comp-1  | Comp One  | component |
        | comp-2  | Comp Two  | component |
      When I call findByType with "component"
      Then the result contains 2 nodes
      And both nodes have type "component"

    Scenario: Find nodes by layer
      Given these nodes exist in Neo4j:
        | id     | name     | type      | layer    |
        | comp-a | Comp A   | component | layer-x  |
        | comp-b | Comp B   | component | layer-x  |
        | comp-c | Comp C   | component | layer-y  |
      When I call findByLayer with "layer-x"
      Then the result contains 2 nodes
      And both nodes have layer "layer-x"

    Scenario: Check node existence
      Given a node "exists-comp" exists in Neo4j
      When I call exists with "exists-comp"
      Then the result is true

    Scenario: Check node existence returns false for missing
      When I call exists with "missing-comp"
      Then the result is false

    Scenario: Delete a node
      Given a node "delete-me" exists in Neo4j
      When I call delete with "delete-me"
      Then no node with id "delete-me" exists in Neo4j

    Scenario: Delete cascades to related edges
      Given a node "cascade-node" exists in Neo4j
      And an edge exists from "cascade-node" to "other-node" with type "DEPENDS_ON"
      When I call delete with "cascade-node"
      Then no edges reference "cascade-node"

    Scenario: Tags are stored as a JSON string property
      Given I save a node with id "tag-node" and tags ["alpha", "beta"]
      When I call findById with "tag-node"
      Then the node tags are ["alpha", "beta"]
      And the raw Neo4j property "tags" is a JSON string
