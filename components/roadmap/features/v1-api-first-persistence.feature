Feature: API-First Persistence
  As a runtime operator
  I want API mutations to persist across deploys
  So that the database is the source of truth, not seed.sql

  Background:
    Given the API server is running with a persistent database

  Scenario: Schema is applied on startup without wiping data
    Given the database contains a component "test-comp" with name "Test Component"
    When the server restarts and applies schema
    Then the component "test-comp" still exists with name "Test Component"

  Scenario: API mutations survive server restart
    Given the database is empty
    When I create a component "new-svc" with name "New Service" via the API
    And the server restarts
    Then the component "new-svc" exists with name "New Service"

  Scenario: Docker build compiles TypeScript without rebuilding the database
    Given the build command is "npm run build"
    When the Dockerfile build step is "npm run build:ts"
    Then the build does not execute "build:data"
    And the build does not execute "build:db"
    And the build does not execute "seed:features"

  Scenario: Seed endpoint is available for one-time bootstrap
    Given the database is empty
    When I call POST /api/admin/seed with admin credentials
    Then the database is populated with components from seed.sql
    And the response includes the count of seeded components

  Scenario: Seed endpoint is idempotent
    Given the database contains seeded data
    When I call POST /api/admin/seed with admin credentials
    Then existing data is upserted without duplicates
    And the response includes the count of seeded components

  Scenario: Seed endpoint requires admin scope
    When I call POST /api/admin/seed without authentication
    Then the response status is 401

  Scenario: Seed endpoint rejects non-admin keys
    When I call POST /api/admin/seed with read-only credentials
    Then the response status is 403

  Scenario: Render config includes persistent disk
    Given the render.yaml configuration
    Then it includes a persistent disk mounted at /data
    And the DB_PATH environment variable points to the persistent disk

  Scenario: Server uses DB_PATH from environment
    Given DB_PATH is set to "/data/architecture.db"
    When the server resolves the database path
    Then it uses "/data/architecture.db" instead of the default path
