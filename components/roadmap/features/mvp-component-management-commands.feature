Feature: Component Management Commands
  As a project maintainer using OpenCode
  I want slash commands to create, update, delete components and manage their properties
  So that I can maintain the roadmap without editing SQL files directly

  # ── CreateComponent use case ────────────────────────────────────

  Scenario: Create a new component with required fields
    Given no node with id "new-service" exists
    When I create a component with id "new-service" name "New Service" type "app" and layer "supervisor-layer"
    Then the node "new-service" is saved with name "New Service" and type "app"
    And a CONTAINS edge from "supervisor-layer" to "new-service" is created

  Scenario: Create a component with optional description and tags
    Given no node with id "audit-log" exists
    When I create a component with id "audit-log" name "Audit Log" type "component" layer "observability-dashboard" description "Tracks all changes" and tags "logging,audit"
    Then the node "audit-log" is saved with description "Tracks all changes"
    And the node "audit-log" has tags "logging" and "audit"

  Scenario: Create a component generates default version entries
    Given no node with id "new-service" exists
    When I create a component with id "new-service" name "New Service" type "app" and layer "supervisor-layer"
    Then versions "overview", "mvp", "v1", "v2" are created for node "new-service"
    And all versions have progress 0 and status "planned"

  Scenario: Reject creating a component with a duplicate id
    Given a component node "supervisor" exists
    When I create a component with id "supervisor" name "Duplicate" type "app" and layer "supervisor-layer"
    Then the create operation fails with error "already exists"

  Scenario: Reject creating a component with an invalid type
    When I create a component with id "bad-type" name "Bad" type "invalid" and layer "supervisor-layer"
    Then the create operation fails with error "Invalid node type"

  # ── DeleteComponent use case ────────────────────────────────────

  Scenario: Delete an existing component and its related data
    Given a component node "doomed" exists
    And a version "mvp" for component "doomed" with progress 0
    And a feature for component "doomed"
    And a "CONTAINS" edge from "supervisor-layer" to "doomed"
    When I delete the component "doomed"
    Then the node "doomed" is removed
    And all versions for "doomed" are removed
    And all features for "doomed" are removed
    And all edges referencing "doomed" are removed

  Scenario: Reject deleting a nonexistent component
    Given no node with id "ghost" exists
    When I delete the component "ghost"
    Then the delete operation fails with error "Node not found"

  # ── Publish workflow ────────────────────────────────────────────

  Scenario: Publish rebuilds data and exports JSON
    Given a database with architecture data
    When I run the publish workflow
    Then the export produces a JSON file
    And the exported data contains the latest node data

  # ── Individual command files removed in favour of AGENTS.md ─────

  Scenario: Individual component command files have been removed
    Given the project has an .opencode/commands directory
    Then no file "component-create.md" exists in .opencode/commands
    And no file "component-delete.md" exists in .opencode/commands
    And no file "component-update.md" exists in .opencode/commands
    And no file "component-publish.md" exists in .opencode/commands

  Scenario: Only bdd and ship command files remain
    Given the project has an .opencode/commands directory
    Then only command files "bdd.md" and "ship.md" exist

  # ── AGENTS.md documents all API endpoints ─────────────────────

  Scenario: AGENTS.md documents the REST API endpoints
    Given the project source directory
    Then the file "AGENTS.md" contains "REST API"
    And the file "AGENTS.md" contains "POST" "/api/components"
    And the file "AGENTS.md" contains "DELETE" "/api/components"
    And the file "AGENTS.md" contains "GET" "/api/architecture"
    And the file "AGENTS.md" contains "GET" "/api/health"

  Scenario: AGENTS.md contains curl examples for API usage
    Given the project source directory
    Then the file "AGENTS.md" contains "curl"
    And the file "AGENTS.md" contains "https://roadmap-5vvp.onrender.com"

  # ── Remaining command files use adapter layer, not raw DB access ─

  Scenario: Remaining command files must not contain raw sqlite3 CLI references
    Given the project has an .opencode/commands directory
    Then no command file contains a raw "sqlite3" CLI invocation

  # ── CLI adapter scripts exist ───────────────────────────────────

  Scenario: CLI adapter scripts exist for component management
    Given the project source directory
    Then a CLI adapter "component-create.ts" exists in src/adapters/cli
    And a CLI adapter "component-delete.ts" exists in src/adapters/cli
