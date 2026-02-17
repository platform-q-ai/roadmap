Feature: Unified Validation Error
  As a maintainer of the codebase
  I want a single ValidationError class in the domain layer
  So that error identity checks are reliable across all layers

  # ── Single source of truth ─────────────────────────────────

  Scenario: Domain layer defines ValidationError
    Given the project source directory
    Then the file "src/domain/errors.ts" exports a class "ValidationError"

  Scenario: Use-cases layer does not define its own ValidationError
    Given the project source directory
    Then the file "src/use-cases/errors.ts" does not define a class "ValidationError"

  Scenario: Use-cases barrel re-exports the domain ValidationError
    Given the project source directory
    Then the file "src/use-cases/index.ts" re-exports "ValidationError" from the domain layer

  Scenario: All use-case files import ValidationError from domain
    Given the project source directory
    Then no use-case file imports ValidationError from "./errors.js"
