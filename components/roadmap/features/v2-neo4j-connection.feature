@wip @v2
Feature: Neo4j Connection & Configuration
  As the roadmap application
  I want to connect to Neo4j using environment variables
  So that credentials are secure and the connection is reliable

  Neo4j replaces SQLite as the persistence layer. Connection
  credentials are stored securely via environment variables, never in code or config
  files committed to version control.

  Rule: Neo4j connection is configured via environment variables

    Scenario: Connect to Neo4j using environment variables
      Given the environment variable "NEO4J_URI" is set to "bolt://localhost:7687"
      And the environment variable "NEO4J_USER" is set to "neo4j"
      And the environment variable "NEO4J_PASSWORD" is set to a secure value
      When the application creates a Neo4j connection
      Then the connection is established successfully
      And the driver verifies connectivity with a test query

    Scenario: Connection fails gracefully when NEO4J_URI is missing
      Given the environment variable "NEO4J_URI" is not set
      When the application attempts to create a Neo4j connection
      Then a configuration error is thrown with message containing "NEO4J_URI"
      And no connection is established

    Scenario: Connection fails gracefully when NEO4J_PASSWORD is missing
      Given the environment variable "NEO4J_URI" is set to "bolt://localhost:7687"
      And the environment variable "NEO4J_PASSWORD" is not set
      When the application attempts to create a Neo4j connection
      Then a configuration error is thrown with message containing "NEO4J_PASSWORD"

    Scenario: Connection uses encrypted transport in production
      Given the environment variable "NODE_ENV" is set to "production"
      And the environment variable "NEO4J_URI" starts with "neo4j+s://"
      When the application creates a Neo4j connection
      Then the driver uses encrypted transport
      And the TLS certificate is verified

    Scenario: Connection pool settings are configurable
      Given the environment variable "NEO4J_MAX_CONNECTIONS" is set to "50"
      And the environment variable "NEO4J_ACQUISITION_TIMEOUT" is set to "30000"
      When the application creates a Neo4j connection
      Then the connection pool max size is 50
      And the acquisition timeout is 30000 milliseconds

    Scenario: Connection retries on transient failure
      Given the Neo4j server is temporarily unavailable
      When the application creates a Neo4j connection with retry enabled
      Then it retries the connection up to 3 times
      And it waits with exponential backoff between attempts
      And the final failure is logged with connection details (excluding password)

    Scenario: Credentials are never logged or exposed
      Given a Neo4j connection is configured
      When the connection details are logged
      Then the log output contains the URI
      And the log output does not contain the password
      And the log output does not contain the username
