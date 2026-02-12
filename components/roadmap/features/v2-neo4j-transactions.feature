@wip @v2
Feature: Neo4j Transaction Safety
  As the roadmap application
  I want all Neo4j operations to use transactions
  So that data integrity is maintained and failures roll back cleanly

  Rule: Neo4j operations use transactions for data integrity

    Scenario: Node save runs within a transaction
      Given the Neo4j node repository
      When I save a node and the operation succeeds
      Then the node is committed to the database

    Scenario: Failed save rolls back the transaction
      Given the Neo4j node repository
      When I save a node with an invalid property
      Then the transaction is rolled back
      And no partial data exists in the database

    Scenario: Bulk insert uses a single transaction
      Given 10 nodes to insert
      When I save all 10 nodes in a batch operation
      Then either all 10 nodes are committed or none are
      And the operation uses a single transaction

    Scenario: Concurrent writes are serialised safely
      Given two concurrent requests to update node "shared-node"
      When both requests execute simultaneously
      Then both writes complete without data corruption
      And the final state reflects one of the two writes
