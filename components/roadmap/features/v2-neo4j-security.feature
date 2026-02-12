@wip @v2
Feature: Neo4j Connection Security
  As the roadmap application
  I want Neo4j credentials handled securely
  So that passwords are never exposed in code, logs, or client responses

  Rule: Neo4j connection credentials are handled securely

    Scenario: Password is not stored in any configuration file
      Given the project source directory
      When I search all files for the Neo4j password
      Then no file in the repository contains a hardcoded password
      And credentials are only read from environment variables

    Scenario: Connection string does not leak to client responses
      Given the API server is running with Neo4j backend
      When I send a GET request that causes a database error
      Then the error response does not contain the connection URI
      And the error response does not contain credentials
      And the error response contains a generic error message

    Scenario: Database user has minimum required privileges
      Given the Neo4j user for the application
      Then the user has read and write access to the application database
      And the user does not have admin privileges
      And the user cannot create or drop databases

    Scenario: Environment variables for Neo4j are documented
      Given the project documentation
      Then it lists "NEO4J_URI" as required
      And it lists "NEO4J_USER" as required
      And it lists "NEO4J_PASSWORD" as required
      And it lists "NEO4J_DATABASE" as optional with default "neo4j"
      And it lists "NEO4J_MAX_CONNECTIONS" as optional with default "100"
