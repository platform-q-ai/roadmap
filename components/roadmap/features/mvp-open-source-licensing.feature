Feature: Open-Source Licensing
  As a developer considering using the roadmap project
  I want the repository to include a clear open-source license
  So that I can legally use, modify, and distribute the software

  # ── LICENSE file ───────────────────────────────────────────────────

  Scenario: LICENSE file exists in the repository root
    Given the project source directory
    Then a file "LICENSE" exists in the project

  Scenario: LICENSE file contains a recognised open-source license
    Given the project source directory
    Then the "LICENSE" file contains a valid SPDX license identifier
    And the license text is non-empty and at least 10 lines long

  Scenario: LICENSE file includes a copyright notice
    Given the project source directory
    Then the "LICENSE" file contains a line matching "Copyright"

  # ── package.json license field ─────────────────────────────────────

  Scenario: package.json declares a license field
    Given the package.json file
    Then the "license" field is present and non-empty

  Scenario: package.json license matches the LICENSE file
    Given the package.json file
    And the "LICENSE" file in the project root
    Then the "license" field in package.json matches the SPDX identifier in the LICENSE file
