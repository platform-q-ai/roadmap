Feature: Render API Commands and README Update
  As a project maintainer
  I want the OpenCode commands to use the production Render API URL
  And the README to reflect the live Render deployment
  So that commands work against the deployed service and documentation is accurate

  # ── Commands use Render production URL ──────────────────────────────

  Scenario: All component commands use the Render production URL
    Given the project has an .opencode/commands directory
    Then every component command file references the Render production URL

  Scenario: No component command references localhost
    Given the project has an .opencode/commands directory
    Then no component command file contains "http://localhost:3000"

  Scenario: component-create.md curl examples use Render URL
    Given the project has an .opencode/commands directory
    Then the command file "component-create.md" contains the Render base URL in curl examples

  Scenario: component-delete.md curl examples use Render URL
    Given the project has an .opencode/commands directory
    Then the command file "component-delete.md" contains the Render base URL in curl examples

  Scenario: component-update.md curl examples use Render URL
    Given the project has an .opencode/commands directory
    Then the command file "component-update.md" contains the Render base URL in curl examples

  Scenario: component-progress.md curl examples use Render URL
    Given the project has an .opencode/commands directory
    Then the command file "component-progress.md" contains the Render base URL in curl examples

  Scenario: component-publish.md curl examples use Render URL
    Given the project has an .opencode/commands directory
    Then the command file "component-publish.md" contains the Render base URL in curl examples

  # ── README reflects Render deployment ───────────────────────────────

  Scenario: README references the Render live URL
    Given the project README file
    Then the README contains the Render deployment URL "https://roadmap-5vvp.onrender.com"

  Scenario: README does not reference GitHub Pages deployment
    Given the project README file
    Then the README does not contain "github.io/roadmap"
    And the README does not contain "GitHub Pages"

  Scenario: README does not reference the pages.yml workflow
    Given the project README file
    Then the README does not contain "pages.yml"

  Scenario: README deployment section describes Render
    Given the project README file
    Then the README deployment section mentions "Render"

  Scenario: README tech stack references Render instead of GitHub Actions for deployment
    Given the project README file
    Then the README does not contain "CI/CD to GitHub Pages"

  # ── GitHub Pages workflow removed ───────────────────────────────────

  Scenario: GitHub Pages workflow file does not exist
    Given the project source directory
    Then no file "pages.yml" exists in .github/workflows
