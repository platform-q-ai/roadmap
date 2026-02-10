Feature: User Knowledge Graph (MVP)
  A persistent entity-relationship store for domain context:
  people, projects, preferences, conventions, deadlines.

  Background:
    Given the User Knowledge Graph SQLite database exists

  Scenario: Add an entity
    When an entity is added with type "person" and name "Alice"
    Then the entity exists in the graph with a unique ID
    And it has type "person" and name "Alice"

  Scenario: Add a relationship between entities
    Given entities "Alice" (person) and "acme-saas" (project) exist
    When a relationship "OWNS" is added from "Alice" to "acme-saas"
    Then the edge exists with type "OWNS"
    And it references both entities

  Scenario: Query 1-hop neighbours
    Given "Alice" has relationships to "acme-saas", "Bob", and "minimal-comments"
    When querying neighbours of "Alice"
    Then all 3 connected entities are returned
    And each result includes the relationship type

  Scenario: Search entities by text
    Given entities "Alice", "Bob", and "acme-saas" exist
    When searching for "alice"
    Then the entity "Alice" is returned

  Scenario: Add entity with metadata
    When an entity is added with type "preference" name "no-orms" and metadata '{"reason": "team decision"}'
    Then the entity exists with the metadata attached
