Feature: Quality Checks Alignment
  As a developer on the roadmap project
  I want the same quality gates as the open-bot repository
  So that code quality standards are consistent across all projects

  # ─── Pre-commit pipeline completeness ────────────────────

  Scenario: Pre-commit pipeline includes coverage enforcement
    Given the pre-commit script in package.json
    Then it should include the "test:coverage" step
    And it should not include a bare "test:unit" step without coverage

  Scenario: Pre-commit pipeline includes BDD feature tests
    Given the pre-commit script in package.json
    Then it should include the "test:features" step

  Scenario: Pre-commit pipeline runs 7 stages in order
    Given the pre-commit script in package.json
    Then it should run these stages in order:
      | stage              |
      | check:code-quality |
      | lint               |
      | format:check       |
      | typecheck          |
      | build:ts           |
      | test:coverage      |
      | test:features      |

  # ─── Coverage thresholds ─────────────────────────────────

  Scenario: Coverage thresholds are set at 80%
    Given the vitest config file
    Then the coverage thresholds should be:
      | metric     | value |
      | statements | 80    |
      | branches   | 80    |
      | functions  | 80    |
      | lines      | 80    |

  Scenario: Coverage excludes CLI adapter entry points
    Given the vitest config file
    Then the coverage exclude list should contain "src/adapters/cli/**"

  # ─── Code quality script: BDD feature coverage ──────────

  Scenario: Code quality script checks feature files exist
    Given the code quality script
    Then it should check that "features/" directory contains .feature files

  Scenario: Code quality script checks every feature has scenarios
    Given the code quality script
    Then it should verify each feature file has at least one Scenario

  Scenario: Code quality script runs cucumber dry-run
    Given the code quality script
    Then it should run a cucumber-js dry-run to detect undefined steps

  Scenario: Code quality script detects orphaned step definitions
    Given the code quality script
    Then it should check for orphaned step definitions via usage report

  # ─── Code quality script: barrel bypass detection ───────

  Scenario: Code quality script detects direct imports bypassing barrels
    Given the code quality script
    Then it should check for direct imports that bypass barrel exports in source

  # ─── Code quality script: domain error checking ─────────

  Scenario: Code quality script checks domain layer uses domain-specific errors
    Given the code quality script
    Then it should check that the domain layer does not use "throw new Error("

  # ─── Code quality script: enhanced dead code ────────────

  Scenario: Code quality script runs ESLint unused-vars check
    Given the code quality script
    Then it should count ESLint "@typescript-eslint/no-unused-vars" violations

  # ─── Knip: unused exports and dependencies ───────────────

  Scenario: Knip is installed as a devDependency
    Given the package.json file
    Then "knip" should be in devDependencies

  Scenario: Knip config exists with correct entry points
    Given the knip config file
    Then it should specify entry points including "src/adapters/cli/*.ts"
    And it should specify project files including "src/**/*.ts"

  Scenario: Knip has an npm script
    Given the package.json file
    Then there should be a "check:knip" npm script

  Scenario: Code quality script runs knip
    Given the code quality script
    Then it should invoke knip to check for unused exports and dependencies

  # ─── dependency-cruiser: architectural boundaries ────────

  Scenario: dependency-cruiser is installed as a devDependency
    Given the package.json file
    Then "dependency-cruiser" should be in devDependencies

  Scenario: dependency-cruiser config enforces Clean Architecture
    Given the dependency-cruiser config file
    Then it should have a rule preventing domain from importing infrastructure
    And it should have a rule preventing domain from importing adapters
    And it should have a rule detecting circular dependencies

  Scenario: dependency-cruiser has an npm script
    Given the package.json file
    Then there should be a "check:deps" npm script

  Scenario: Code quality script runs dependency-cruiser
    Given the code quality script
    Then it should invoke dependency-cruiser to validate architecture

  # ─── AGENTS.md completeness ─────────────────────────────

  Scenario: AGENTS.md documents all pre-commit stages
    Given the AGENTS.md file
    Then it should document "test:coverage" as a pre-commit stage
    And it should document "test:features" as a pre-commit stage

  Scenario: AGENTS.md documents the code quality checks
    Given the AGENTS.md file
    Then it should document at least 10 code quality script checks

  Scenario: AGENTS.md documents knip and dependency-cruiser
    Given the AGENTS.md file
    Then it should document "knip" as a quality tool
    And it should document "dependency-cruiser" as a quality tool
