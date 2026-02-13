Feature: API-First Persistence
  As a runtime operator
  I want API mutations to persist across deploys
  So that the database is the source of truth, not seed.sql

  Scenario: Schema is applied on startup without wiping data
    Given the API server is running with a persistent database
    And the database contains a component "test-comp" with name "Test Component"
    When the server restarts and applies schema
    Then the component "test-comp" still exists with name "Test Component"

  Scenario: API mutations survive server restart
    Given the API server is running with a persistent database
    And the database is empty
    When I create a component "new-svc" with name "New Service" via the API
    And the server restarts
    Then the component "new-svc" exists with name "New Service"

  Scenario: Docker build compiles TypeScript without rebuilding the database
    Given the Dockerfile exists
    Then the Dockerfile build step is "npm run build:ts"
    And the Dockerfile does not execute "build:data"
    And the Dockerfile does not execute "build:db"
    And the Dockerfile does not execute "seed:features"

  Scenario: Render config includes persistent disk
    Given the render.yaml configuration
    Then it includes a persistent disk mounted at /data
    And the DB_PATH environment variable points to the persistent disk

  Scenario: Server uses DB_PATH from environment
    Given DB_PATH is set to "/data/architecture.db"
    When the server resolves the database path
    Then it uses "/data/architecture.db" instead of the default path
