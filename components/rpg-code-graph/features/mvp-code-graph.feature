Feature: RPG Code Graph (MVP)
  Static analysis on repo load builds a structural graph of the
  codebase: files, imports, exports, classes, functions.

  Background:
    Given a repository with source files exists

  Scenario: Build initial graph from repo
    When the Code Graph builder runs on the repository
    Then nodes are created for each source file
    And edges are created for import relationships
    And the graph is stored in SQLite

  Scenario: Extract function exports
    Given a file "auth/handler.ts" exports function "verifyToken"
    When the AST parser processes the file
    Then a function node "verifyToken" exists
    And an EXPORTS edge connects the file to the function

  Scenario: Extract import relationships
    Given "api/routes.ts" imports from "auth/handler.ts"
    When the AST parser processes both files
    Then an IMPORTS edge connects "api/routes.ts" to "auth/handler.ts"

  Scenario: Infer modules from directory structure
    Given the repository has directories "auth/", "api/", "db/"
    When the Code Graph builder runs
    Then module nodes are created for "auth", "api", "db"
    And CONTAINS edges connect modules to their files

  Scenario: Query files in a module
    Given the module "auth" contains "handler.ts" and "middleware.ts"
    When querying files in module "auth"
    Then both files are returned
