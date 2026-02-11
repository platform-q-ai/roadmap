Feature: Code Quality Checks
  Quality checks run after every commit in the BDD pipeline. The checks
  are context-sensitive — what gets checked depends on which BDD stage
  was just committed. Some check failures block progression (hard gates),
  others are recorded but allowed (soft gates). This ensures issues are
  caught early without creating false blockers at stages where failures
  are expected (e.g., red tests).

  Background:
    Given the coding-agent-spawner-mcp server is running
    And a running worker named "auth-worker"
    And a task "task-1" linked to "auth-worker"

  # --- Context-Sensitive Check Suites ---

  Scenario: Quality checks after feature file commit
    Given task "task-1" just committed after instruct_feature_file
    When the Sub-Agent calls run_quality_checks for "task-1"
    Then the Worker is instructed to run:
      | check              | type       |
      | Gherkin syntax     | hard gate  |
      | Lint               | hard gate  |
    And the results are recorded in the transition

  Scenario: Quality checks after step definitions commit
    Given task "task-1" just committed after instruct_step_defs
    When the Sub-Agent calls run_quality_checks for "task-1"
    Then the Worker is instructed to run:
      | check              | type       |
      | Lint               | hard gate  |
      | Type-check         | soft gate  |
    And type-check failures are recorded but do not block progression
    Because step definition stubs may reference types not yet implemented

  Scenario: Quality checks after unit tests commit
    Given task "task-1" just committed after instruct_unit_tests
    When the Sub-Agent calls run_quality_checks for "task-1"
    Then the Worker is instructed to run:
      | check              | type       |
      | Lint               | hard gate  |
      | Test syntax valid  | hard gate  |
      | Run tests          | soft gate  |
    And test failures are recorded as expected (red phase)
    And the number of failing tests is recorded for later comparison

  Scenario: Quality checks after implementation commit
    Given task "task-1" just committed after instruct_implementation
    When the Sub-Agent calls run_quality_checks for "task-1"
    Then the Worker is instructed to run:
      | check              | type       |
      | Lint               | hard gate  |
      | Type-check         | hard gate  |
      | Run tests          | hard gate  |
      | Coverage report    | soft gate  |
    And all tests must pass (green phase)
    And coverage percentage is recorded for comparison at refactor stage

  Scenario: Quality checks after refactor commit
    Given task "task-1" just committed after instruct_refactor
    And the post-implementation coverage was 85%
    When the Sub-Agent calls run_quality_checks for "task-1"
    Then the Worker is instructed to run:
      | check              | type       |
      | Lint               | hard gate  |
      | Type-check         | hard gate  |
      | Run tests          | hard gate  |
      | Coverage report    | hard gate  |
    And all tests must still pass
    And coverage must be >= 85% (the pre-refactor baseline)

  # --- Hard Gate Behavior ---

  Scenario: Hard gate failure blocks progression
    Given task "task-1" just committed after instruct_implementation
    When the Sub-Agent calls run_quality_checks
    And the lint check fails
    Then the tool returns the check results with lint marked as "failed"
    And the allowed_next includes only ["instruct_implementation"]
    And the Sub-Agent must fix the issue and re-enter the pipeline from instruct_implementation

  Scenario: Hard gate failure after implementation allows going back to implementation
    Given task "task-1" at stage "run_quality_checks" in context "post_implementation"
    And the test run shows 3 failing tests
    When the Sub-Agent observes the failures
    Then the allowed_next is ["instruct_implementation"]
    And the Sub-Agent can call instruct_implementation to fix the code

  Scenario: Hard gate failure after refactor allows going back to refactor
    Given task "task-1" at stage "run_quality_checks" in context "post_refactor"
    And the coverage dropped from 85% to 72%
    When the Sub-Agent observes the failure
    Then the allowed_next is ["instruct_refactor"]
    And the Sub-Agent can call instruct_refactor to restore coverage

  # --- Soft Gate Behavior ---

  Scenario: Soft gate failure is recorded but does not block
    Given task "task-1" just committed after instruct_step_defs
    When the Sub-Agent calls run_quality_checks
    And the type-check reports 5 errors
    Then the check results show type-check as "failed (soft)"
    And the errors are recorded in quality_results JSON
    And the task is allowed to proceed to instruct_unit_tests

  Scenario: Soft gate test failures during red phase are recorded with count
    Given task "task-1" just committed after instruct_unit_tests
    When the Sub-Agent calls run_quality_checks
    And 7 tests fail out of 7 total
    Then the check results show tests as "expected_failures"
    And the failing test count (7) is recorded
    And the task is allowed to proceed to instruct_implementation

  # --- Quality Results Format ---

  Scenario: Quality results are stored as structured JSON
    When quality checks complete for any stage
    Then the quality_results column contains JSON like:
      """
      {
        "context": "post_implementation",
        "checks": [
          { "name": "lint", "status": "passed", "gate": "hard" },
          { "name": "type-check", "status": "passed", "gate": "hard" },
          { "name": "tests", "status": "passed", "gate": "hard", "total": 12, "passed": 12, "failed": 0 },
          { "name": "coverage", "status": "passed", "gate": "soft", "percentage": 87 }
        ],
        "overall": "passed",
        "blocking": false
      }
      """

  Scenario: Failed quality results include error details
    When a quality check fails
    Then the check entry includes an "output" field with the failure details
    And the overall status is "failed" if any hard gate failed

  # --- Custom Check Override ---

  Scenario: Sub-Agent can specify custom checks
    Given task "task-1" is at a run_quality_checks stage
    When the Sub-Agent calls run_quality_checks with checks ["lint", "type-check"]
    Then only lint and type-check are run
    And the default suite for the current context is overridden

  Scenario: Custom checks still respect gate types
    When the Sub-Agent overrides checks to ["tests"]
    And tests fail in the post_implementation context
    Then the failure is still treated as a hard gate
    And progression is blocked

  # --- Quality Checks With No Issues ---

  Scenario: All checks pass and pipeline proceeds
    Given task "task-1" at run_quality_checks in context "post_implementation"
    When all checks pass
    Then the tool returns overall "passed" and blocking false
    And the allowed_next is the next BDD stage (e.g., "instruct_refactor")

  # --- Re-running Quality Checks ---

  Scenario: Quality checks can be re-run after a back-transition fix
    Given task "task-1" failed quality checks after instruct_implementation
    And the Sub-Agent called instruct_implementation again to fix the issue
    And the Sub-Agent called commit again
    When the Sub-Agent calls run_quality_checks again
    Then the checks run fresh against the new commit
    And new results replace the previous failure in the decision (but history preserves both)
