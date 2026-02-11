Feature: Workflow Types
  Every coding task is classified as greenfield, bugfix, or change.
  The pipeline sequence is identical for all three types — the
  difference is in the contextual hints the enforcer provides and
  how the Sub-Agent should craft its prompts at each stage.

  Background:
    Given the coding-agent-spawner-mcp server is running
    And a running worker named "auth-worker"

  # --- Greenfield Workflow ---

  Scenario: Accept a greenfield goal
    When the Sub-Agent calls accept_goal with:
      | field  | value                           |
      | goal   | Build user authentication module |
      | type   | greenfield                      |
      | worker | auth-worker                     |
    Then the task is created with type "greenfield"
    And the response includes hint:
      """
      Write feature files that describe the desired behavior from scratch. Think about happy paths, edge cases, and error scenarios.
      """

  Scenario: Greenfield feature file stage hint
    Given a greenfield task "task-1" at stage "accept_goal"
    When the Sub-Agent calls instruct_feature_file
    Then the response includes next "commit"
    And the Sub-Agent is expected to have the Worker create new feature files from scratch

  # --- Bugfix Workflow ---

  Scenario: Accept a bugfix goal
    When the Sub-Agent calls accept_goal with:
      | field  | value                                              |
      | goal   | Fix: login times out after 3 seconds on slow connections |
      | type   | bugfix                                             |
      | worker | auth-worker                                        |
    Then the task is created with type "bugfix"
    And the response includes hint:
      """
      Write or modify a scenario that exposes the bug — describing correct behavior the system should exhibit but currently doesn't. This failing scenario becomes your regression test.
      """

  Scenario: Bugfix feature file stage creates a regression scenario
    Given a bugfix task "task-1" at stage "accept_goal"
    When the Sub-Agent calls instruct_feature_file with a prompt that modifies an existing feature
    Then the prompt is dispatched to the Worker
    And the enforcer does not validate the prompt content (freehand)
    But the hint from accept_goal guides the Sub-Agent to write a regression scenario

  Scenario: Bugfix unit test stage — the red test IS the regression test
    Given a bugfix task "task-1" progressing through the pipeline
    When the Sub-Agent reaches instruct_unit_tests
    Then the unit tests should include a test that reproduces the bug
    And that test should fail against the current (buggy) implementation
    And after instruct_implementation, the test should pass

  # --- Change/Extension Workflow ---

  Scenario: Accept a change goal
    When the Sub-Agent calls accept_goal with:
      | field  | value                                                       |
      | goal   | Change: session timeout from 30min to configurable per-org  |
      | type   | change                                                      |
      | worker | auth-worker                                                 |
    Then the task is created with type "change"
    And the response includes hint:
      """
      Update or add scenarios to reflect the new expected behavior. Modify existing scenarios where business rules have changed. Watch them fail, then update the implementation.
      """

  Scenario: Change feature file stage modifies existing scenarios
    Given a change task "task-1" at stage "accept_goal"
    When the Sub-Agent calls instruct_feature_file
    Then the Sub-Agent is expected to have the Worker modify existing feature files
    And add new scenarios for the changed behavior
    And the modified scenarios should fail against the current implementation

  Scenario: Change workflow keeps feature files in sync with reality
    Given a change task has completed the full pipeline
    Then the feature files reflect the new business rules
    And old scenarios that no longer apply have been updated or removed
    And no scenarios describe behavior that contradicts the new implementation

  # --- Type Does Not Affect Pipeline Sequence ---

  Scenario Outline: All workflow types follow the same pipeline
    When the Sub-Agent calls accept_goal with type "<type>"
    Then the required sequence is:
      | step | stage                   |
      | 1    | accept_goal             |
      | 2    | instruct_feature_file   |
      | 3    | commit                  |
      | 4    | run_quality_checks      |
      | 5    | instruct_step_defs      |
      | 6    | commit                  |
      | 7    | run_quality_checks      |
      | 8    | instruct_unit_tests     |
      | 9    | commit                  |
      | 10   | run_quality_checks      |
      | 11   | instruct_implementation |
      | 12   | commit                  |
      | 13   | run_quality_checks      |
      | 14   | instruct_refactor       |
      | 15   | commit                  |
      | 16   | run_quality_checks      |
      | 17   | run_validation          |
      | 18   | commit                  |
      | 19   | mark_complete           |

    Examples:
      | type       |
      | greenfield |
      | bugfix     |
      | change     |

  # --- Type Is Recorded and Queryable ---

  Scenario: Task type is visible in check_task_status
    Given tasks of each type exist
    When the Sub-Agent calls check_task_status for each
    Then each response includes the correct type field

  Scenario: Invalid type is rejected
    When the Sub-Agent calls accept_goal with type "hotfix"
    Then the tool returns a validation error
    And the accepted types are "greenfield", "bugfix", "change"

  # --- Type-Specific Hints Are Only Guidance ---

  Scenario: Hints do not enforce prompt content
    Given a bugfix task "task-1"
    When the Sub-Agent calls instruct_feature_file with a prompt that creates entirely new feature files instead of modifying existing ones
    Then the tool accepts the call
    Because the enforcer controls sequence, not prompt content
    And the hint is advisory, not enforced
