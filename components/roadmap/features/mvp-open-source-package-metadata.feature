Feature: Open-Source Package Metadata
  As a developer discovering the roadmap project on npm or GitHub
  I want package.json to contain complete project metadata
  So that I can find the source repository, report bugs, and identify the maintainers

  # ── Required metadata fields ───────────────────────────────────────

  Scenario: package.json declares a repository field
    Given the package.json file
    Then the "repository" field is present
    And the "repository" field contains a valid GitHub URL

  Scenario: package.json declares an author field
    Given the package.json file
    Then the "author" field is present and non-empty

  Scenario: package.json declares a bugs field
    Given the package.json file
    Then the "bugs" field is present
    And the "bugs" field contains a URL ending with "/issues"

  Scenario: package.json declares a homepage field
    Given the package.json file
    Then the "homepage" field is present and non-empty

  Scenario: package.json declares keywords for discoverability
    Given the package.json file
    Then the "keywords" field is a non-empty array
    And the "keywords" array contains at least 3 entries

  # ── Publish safety ─────────────────────────────────────────────────

  Scenario: package.json is marked as private
    Given the package.json file
    Then the "private" field is true
