Feature: Security Vulnerability Reporting Policy
  As a security researcher who discovers a vulnerability
  I want the repository to publish a clear security policy
  So that I know how to report issues responsibly and what to expect

  # ── SECURITY.md existence ──────────────────────────────────────────

  Scenario: SECURITY.md exists in the repository root
    Given the project source directory
    Then a file "SECURITY.md" exists in the project

  Scenario: SECURITY.md describes how to report a vulnerability
    Given the project source directory
    Then the "SECURITY.md" file contains a section titled "Reporting a Vulnerability"
    And the section includes a contact method for private disclosure

  Scenario: SECURITY.md does not instruct reporters to open public issues
    Given the project source directory
    Then the "SECURITY.md" file does not instruct reporters to open a public GitHub issue

  Scenario: SECURITY.md states a response-time commitment
    Given the project source directory
    Then the "SECURITY.md" file contains a response timeframe in business days

  Scenario: SECURITY.md lists supported versions
    Given the project source directory
    Then the "SECURITY.md" file contains a section titled "Supported Versions"
