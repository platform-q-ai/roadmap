Feature: Remove seed process from build pipeline
  As a platform engineer
  I want the seed process completely removed from the build pipeline
  So that the API is the sole source of truth and deploys never overwrite persistent data

  Background:
    Given the project root directory

  Rule: No seed-related npm scripts remain

    Scenario: build script only compiles TypeScript
      When I read the package.json scripts
      Then the "build" script should equal "npm run build:ts"

    Scenario: build:db script is removed
      When I read the package.json scripts
      Then there should be no "build:db" script

    Scenario: build:data script is removed
      When I read the package.json scripts
      Then there should be no "build:data" script

    Scenario: seed:features script is removed
      When I read the package.json scripts
      Then there should be no "seed:features" script

    Scenario: export script is removed
      When I read the package.json scripts
      Then there should be no "export" script

  Rule: CLI seed and export adapters are removed

    Scenario: seed-features CLI adapter is removed
      Then the file "src/adapters/cli/seed-features.ts" should not exist

    Scenario: export CLI adapter is removed
      Then the file "src/adapters/cli/export.ts" should not exist

  Rule: Generated data files are removed

    Scenario: web/data.json is removed
      Then the file "web/data.json" should not exist

    Scenario: db/architecture.db is removed from the repository
      Then the file "db/architecture.db" should not exist

  Rule: seed.sql is retained as a reference

    Scenario: seed.sql is kept for reference and API seeding script
      Then the file "seed.sql" should exist

    Scenario: schema.sql is kept for reference
      Then the file "schema.sql" should exist

  Rule: Dockerfile has no seed artifacts

    Scenario: Dockerfile does not reference seed.sql
      When I read the Dockerfile
      Then it should not contain "seed.sql"

    Scenario: Dockerfile does not reference data.json
      When I read the Dockerfile
      Then it should not contain "data.json"
