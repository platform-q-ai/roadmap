Feature: Open-Source Community Documentation
  As an open-source contributor
  I want CONTRIBUTING.md and CODE_OF_CONDUCT.md to exist
  So that I understand contribution guidelines and expected behaviour

  # ── CONTRIBUTING.md ─────────────────────────────────────────

  Scenario: CONTRIBUTING.md exists in the repository root
    Given the project source directory
    Then a file "CONTRIBUTING.md" exists in the project

  Scenario: CONTRIBUTING.md describes how to contribute
    Given the project source directory
    Then the "CONTRIBUTING.md" file contains a section titled "Getting Started"
    And the "CONTRIBUTING.md" file contains a section titled "Pull Requests"

  # ── CODE_OF_CONDUCT.md ─────────────────────────────────────

  Scenario: CODE_OF_CONDUCT.md exists in the repository root
    Given the project source directory
    Then a file "CODE_OF_CONDUCT.md" exists in the project

  Scenario: CODE_OF_CONDUCT.md includes enforcement information
    Given the project source directory
    Then the "CODE_OF_CONDUCT.md" file contains a section titled "Enforcement"
