@wip @v2
Feature: Neo4j Native Graph Traversals
  As the roadmap application
  I want to perform native graph traversals in Neo4j
  So that multi-hop queries, shortest paths, and cycle detection are efficient

  Rule: Neo4j enables native graph traversal queries

    Scenario: Multi-hop dependency traversal
      Given this dependency chain exists:
        | source    | target    |
        | comp-a    | comp-b    |
        | comp-b    | comp-c    |
        | comp-c    | comp-d    |
      When I query for all transitive dependencies of "comp-a" up to depth 3
      Then the result contains "comp-b", "comp-c", "comp-d"

    Scenario: Reverse dependency traversal (dependents)
      Given this dependency chain exists:
        | source    | target    |
        | comp-a    | comp-d    |
        | comp-b    | comp-d    |
        | comp-c    | comp-d    |
      When I query for all transitive dependents of "comp-d" up to depth 1
      Then the result contains "comp-a", "comp-b", "comp-c"

    Scenario: Shortest path between two components
      Given a graph with multiple paths from "start" to "end"
      When I query for the shortest path from "start" to "end"
      Then the result contains the path with the fewest hops
      And each hop includes the edge type and label

    Scenario: Layer containment subtree
      Given a layer "supervisor-layer" containing 4 components
      When I query the containment subtree of "supervisor-layer"
      Then the result contains 4 child nodes
      And each child has a CONTAINS relationship from "supervisor-layer"

    Scenario: Cycle detection in dependency graph
      Given this dependency chain exists:
        | source    | target    |
        | comp-a    | comp-b    |
        | comp-b    | comp-c    |
        | comp-c    | comp-a    |
      When I check for cycles in the dependency graph
      Then a cycle is detected involving "comp-a", "comp-b", "comp-c"

    Scenario: Component neighbourhood query
      Given "center-comp" has 3 outbound and 2 inbound edges
      When I query the 1-hop neighbourhood of "center-comp"
      Then the result contains 5 related components
      And each result includes the edge type and direction
