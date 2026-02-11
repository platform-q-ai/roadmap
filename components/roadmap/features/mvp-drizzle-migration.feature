Feature: Drizzle ORM Migration
  As a project maintainer
  I want the infrastructure layer to use Drizzle ORM instead of raw SQL
  So that the database layer is type-safe, schema is code, and progress survives rebuilds

  The migration replaces hand-written better-sqlite3 queries with Drizzle's
  type-safe query builder. Domain entities, repository interfaces, and use cases
  are unchanged — only the infrastructure implementations change.

  # ── Schema as Code ─────────────────────────────────────────────────

  Scenario: Drizzle schema defines all four tables
    Given the Drizzle schema module
    Then it should export a nodes table definition
    And it should export an edges table definition
    And it should export a nodeVersions table definition
    And it should export a features table definition

  Scenario: Nodes table has correct columns
    Given the Drizzle schema nodes table
    Then it should have a text primary key column "id"
    And it should have a text column "name" that is not null
    And it should have a text column "type" that is not null
    And it should have optional text columns "layer", "color", "icon", "description"
    And it should have an integer column "sort_order" defaulting to 0

  Scenario: Node versions table preserves progress on content upsert
    Given a Drizzle database with schema applied
    And a node "test-comp" exists
    And a version "mvp" for "test-comp" with progress 75 and status "in-progress"
    When I upsert version "mvp" for "test-comp" with new content "Updated" via Drizzle
    Then the version should have content "Updated"
    And the version should have progress 75
    And the version should have status "in-progress"

  # ── Repository Parity ──────────────────────────────────────────────

  Scenario: Drizzle node repository implements INodeRepository
    Given a Drizzle database with schema applied
    When I save a node via the Drizzle repository
    Then I can retrieve it by id
    And I can find it by type
    And I can find it by layer
    And I can check it exists
    And I can delete it

  Scenario: Drizzle edge repository implements IEdgeRepository
    Given a Drizzle database with schema applied
    And two nodes exist for edge testing
    When I save an edge via the Drizzle repository
    Then I can retrieve it by source
    And I can retrieve it by target
    And I can retrieve relationships excluding CONTAINS
    And I can delete it

  Scenario: Drizzle version repository implements IVersionRepository
    Given a Drizzle database with schema applied
    And a node "comp-1" exists
    When I save a version via the Drizzle repository
    Then I can retrieve versions by node
    And I can retrieve a specific version by node and version tag
    And I can update progress and status
    And I can delete versions by node

  Scenario: Drizzle feature repository implements IFeatureRepository
    Given a Drizzle database with schema applied
    And a node "comp-1" exists
    When I save a feature via the Drizzle repository
    Then I can retrieve features by node
    And I can retrieve features by node and version
    And I can delete all features
    And I can delete features by node

  # ── Progress Persistence Through Rebuild ────────────────────────────

  Scenario: Progress update survives database rebuild via Drizzle upsert
    Given a Drizzle database with schema and seed data
    When I update progress for "roadmap" version "mvp" to 100 with status "complete" via Drizzle
    And I re-run the seed data via Drizzle upsert
    Then the version "mvp" for "roadmap" should have progress 100
    And the version "mvp" for "roadmap" should have status "complete"

  Scenario: Seed content updates propagate while preserving progress
    Given a Drizzle database with schema and seed data
    When I update progress for "roadmap" version "mvp" to 80 with status "in-progress" via Drizzle
    And I re-seed with updated content for "roadmap" version "mvp"
    Then the version "mvp" for "roadmap" should have the updated content
    And the version "mvp" for "roadmap" should have progress 80
    And the version "mvp" for "roadmap" should have status "in-progress"

  Scenario: Build script does not delete the database
    Given the package.json build scripts
    Then the build:db script should not contain "rm -f"
    And the build:db script should not contain "rm db/"

  # ── Component Update Commands ──────────────────────────────────────

  Scenario: Component update command uses Drizzle repositories
    Given the CLI adapter for component-update
    Then it should import from the Drizzle infrastructure module
    And it should not import from better-sqlite3 directly

  Scenario: Component progress command references API route
    Given the opencode command file for component-progress
    Then it should reference the progress API route
