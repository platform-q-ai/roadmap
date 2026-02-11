Feature: Render API Commands and README Update
  As a project maintainer
  I want the OpenCode commands to use the production Render API URL
  And the README to reflect the live Render deployment
  So that commands work against the deployed service and documentation is accurate

  # ── API documentation uses Render production URL ────────────────────

  Scenario: AGENTS.md documents API with Render production URL
    Given the project source directory
    Then the file "AGENTS.md" contains "https://roadmap-5vvp.onrender.com"

  Scenario: AGENTS.md curl examples use the Render production URL
    Given the project source directory
    Then the file "AGENTS.md" contains "curl"
    And the file "AGENTS.md" contains "https://roadmap-5vvp.onrender.com/api/components"

  Scenario: Individual component command files no longer exist
    Given the project has an .opencode/commands directory
    Then no file "component-create.md" exists in .opencode/commands
    And no file "component-delete.md" exists in .opencode/commands
    And no file "component-update.md" exists in .opencode/commands
    And no file "component-publish.md" exists in .opencode/commands

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
