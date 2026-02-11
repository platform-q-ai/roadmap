Feature: Remove manual updateProgress in favour of derived progress
  As a project maintainer
  I want the manual updateProgress endpoint and use case removed
  Because derived progress from current_version is the sole source of truth
  And the manual write path is dead code that silently gets overridden

  # ── Use case removed ────────────────────────────────────────────────

  Scenario: UpdateProgress use case file does not exist
    Given the project source directory
    Then no file "update-progress.ts" exists in src/use-cases

  Scenario: UpdateProgress is not exported from use-cases barrel
    Given the project source directory
    Then the file "src/use-cases/index.ts" does not contain "UpdateProgress"
    And the file "src/use-cases/index.ts" does not contain "update-progress"

  # ── CLI adapter removed ─────────────────────────────────────────────

  Scenario: component-update CLI adapter does not exist
    Given the project source directory
    Then no file "component-update.ts" exists in src/adapters/cli

  # ── API route removed ───────────────────────────────────────────────

  Scenario: API routes file does not contain updateProgress handler
    Given the project source directory
    Then the file "src/adapters/api/routes.ts" does not contain "handleUpdateProgress"
    And the file "src/adapters/api/routes.ts" does not contain "UpdateProgress"
    And the file "src/adapters/api/routes.ts" does not contain "parseProgressInput"

  Scenario: No PATCH progress route is registered
    Given the project source directory
    Then the file "src/adapters/api/routes.ts" does not contain "PATCH"

  # ── Repository interface cleaned ────────────────────────────────────

  Scenario: IVersionRepository does not declare updateProgress
    Given the project source directory
    Then the file "src/domain/repositories/version-repository.ts" does not contain "updateProgress"

  # ── Infrastructure implementations cleaned ──────────────────────────

  Scenario: SQLite version repository does not implement updateProgress
    Given the project source directory
    Then the file "src/infrastructure/sqlite/version-repository.ts" does not contain "updateProgress"

  Scenario: Drizzle version repository does not implement updateProgress
    Given the project source directory
    Then the file "src/infrastructure/drizzle/version-repository.ts" does not contain "updateProgress"

  # ── OpenCode commands cleaned ───────────────────────────────────────

  Scenario: component-progress command file does not exist
    Given the project has an .opencode/commands directory
    Then no file "component-progress.md" exists in .opencode/commands

  Scenario: component-update command does not reference PATCH progress
    Given the project has an .opencode/commands directory
    Then the command file "component-update.md" does not contain "PATCH"
    And the command file "component-update.md" does not contain "/progress"

  # ── Derived progress remains intact ─────────────────────────────────

  Scenario: Version entity still has deriveProgress method
    Given the project source directory
    Then the file "src/domain/entities/version.ts" contains "deriveProgress"

  Scenario: GetArchitecture still applies derived progress
    Given the project source directory
    Then the file "src/use-cases/get-architecture.ts" contains "applyDerivedProgress"

  # ── Documentation updated ───────────────────────────────────────────

  Scenario: README does not reference update-progress
    Given the project README file
    Then the README does not contain "update-progress"

  Scenario: AGENTS.md does not reference update-progress
    Given the project source directory
    Then the file "AGENTS.md" does not contain "update-progress"
