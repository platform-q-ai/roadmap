@v1
Feature: API Feature Seeding and Export
  As an LLM engineer working autonomously
  I want to seed feature files from the filesystem and export them back
  So that the database and filesystem stay in sync

  # ── Feature Seeding from Filesystem ─────────────────────────────────

  Rule: Feature files seeded from the filesystem use filename prefix for version

    Scenario: Trigger feature re-seed via API
      Given the seed and export API server is running
      And a valid API key with scope "admin"
      And feature files exist in the "components/" directory tree
      When I send a POST request to "/api/admin/seed-features"
      Then the response status is 200
      And the response body has field "seeded" with a positive integer
      And the response body has field "skipped" with an integer
      And features with "mvp-" prefix are stored under version "mvp"
      And features with "v1-" prefix are stored under version "v1"
      And features with "v2-" prefix are stored under version "v2"
      And features without a version prefix default to version "mvp"

    Scenario: Re-seed is idempotent
      Given the seed and export API server is running
      And a valid API key with scope "admin"
      When I trigger feature re-seed twice
      Then the second run produces the same result as the first
      And no duplicate features exist in the database

    Scenario: Re-seed clears stale features
      Given the seed and export API server is running
      And a valid API key with scope "admin"
      And the database has a feature for a deleted file
      When I trigger feature re-seed
      Then the stale feature is removed from the database
      And only features matching filesystem files remain

    Scenario: Seed requires admin scope
      Given the seed and export API server is running
      And a valid API key with scope "write" but not "admin"
      When I send a POST request to "/api/admin/seed-features"
      Then the response status is 403

    Scenario: Seed reports step counts per version
      Given the seed and export API server is running
      And a valid API key with scope "admin"
      And feature files exist in the "components/" directory tree
      When I send a POST request to "/api/admin/seed-features"
      Then the response body has field "step_totals" as an object with:
        | version | total_steps | total_scenarios |
        | mvp     | (integer)   | (integer)       |
        | v1      | (integer)   | (integer)       |
        | v2      | (integer)   | (integer)       |

  # ── Feature File Export ─────────────────────────────────────────────

  Rule: Feature files can be exported back to the filesystem

    Scenario: Export all features to the filesystem
      Given the seed and export API server is running
      And a valid API key with scope "admin"
      And features exist in the database for components "comp-a" and "comp-b"
      When I send a POST request to "/api/admin/export-features"
      Then the response status is 200
      And feature files are written to "components/comp-a/features/"
      And feature files are written to "components/comp-b/features/"
      And each file contains the Gherkin content from the database

    Scenario: Export creates component directories if missing
      Given the seed and export API server is running
      And a valid API key with scope "admin"
      And a feature exists for component "new-comp" but no directory exists
      When I trigger feature export
      Then the directory "components/new-comp/features/" is created
      And the feature file is written there

    Scenario: Export for a single component
      Given the seed and export API server is running
      And a valid API key with scope "admin"
      When I send a POST request to "/api/admin/export-features?component=specific-comp"
      Then the response status is 200
      And only features for "specific-comp" are exported to the filesystem
