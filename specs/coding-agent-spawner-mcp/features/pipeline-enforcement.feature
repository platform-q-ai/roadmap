Feature: BDD Pipeline Enforcement
  The coding-agent-spawner-mcp enforces a strict BDD development process.
  Every coding task follows the same sequence: accept goal, write feature
  file, commit, quality check, write step defs, commit, quality check,
  write unit tests, commit, quality check, implement, commit, quality
  check, refactor, commit, quality check, validate, commit, complete.
  
  The enforcer rejects out-of-sequence calls with structured error
  responses that tell the Sub-Agent exactly what to do next. Back-
  transitions are allowed for specific recovery scenarios. Forward
  skips are never allowed.

  Background:
    Given the coding-agent-spawner-mcp server is running
    And a running worker named "auth-worker" exists

  # --- Happy Path: Full Pipeline ---

  Scenario: Complete pipeline for a greenfield task
    When the Sub-Agent executes the following sequence for a greenfield task:
      | step | tool                     |
      | 1    | accept_goal              |
      | 2    | instruct_feature_file    |
      | 3    | commit                   |
      | 4    | run_quality_checks       |
      | 5    | instruct_step_defs       |
      | 6    | commit                   |
      | 7    | run_quality_checks       |
      | 8    | instruct_unit_tests      |
      | 9    | commit                   |
      | 10   | run_quality_checks       |
      | 11   | instruct_implementation  |
      | 12   | commit                   |
      | 13   | run_quality_checks       |
      | 14   | instruct_refactor        |
      | 15   | commit                   |
      | 16   | run_quality_checks       |
      | 17   | run_validation           |
      | 18   | commit                   |
      | 19   | mark_complete            |
    Then every step is accepted
    And the task status is "complete"
    And the transition history contains 19 entries

  # --- Forward Skip Rejection ---

  Scenario: Reject skipping from accept_goal to instruct_implementation
    Given a task "task-1" at stage "accept_goal"
    When the Sub-Agent calls instruct_implementation for "task-1"
    Then the tool returns a sequence_violation error
    And the error includes current_stage "accept_goal"
    And the error includes attempted_stage "instruct_implementation"
    And the error includes allowed_next ["instruct_feature_file"]
    And the error includes the message "Call instruct_feature_file next."

  Scenario: Reject skipping from instruct_feature_file to instruct_step_defs
    Given a task "task-1" at stage "instruct_feature_file"
    When the Sub-Agent calls instruct_step_defs for "task-1"
    Then the tool returns a sequence_violation error
    And the error includes allowed_next ["commit"]
    And the error includes the message "You must commit the feature file first. Call commit next."

  Scenario: Reject skipping commit to go directly to next BDD stage
    Given a task "task-1" at stage "commit" in context "post_feature_file"
    When the Sub-Agent calls instruct_step_defs for "task-1"
    Then the tool returns a sequence_violation error
    And the error includes allowed_next ["run_quality_checks"]
    And the error includes the message "Quality checks must run before proceeding. Call run_quality_checks next."

  Scenario: Reject skipping quality checks after commit
    Given a task "task-1" has just completed a commit after instruct_unit_tests
    When the Sub-Agent calls instruct_implementation for "task-1"
    Then the tool returns a sequence_violation error
    And the error includes allowed_next ["run_quality_checks"]

  Scenario: Reject mark_complete before validation
    Given a task "task-1" at stage "run_quality_checks" in context "post_refactor"
    When the Sub-Agent calls mark_complete for "task-1"
    Then the tool returns a sequence_violation error
    And the error includes the message "Validation must run before completing."

  Scenario: Reject mark_complete directly after run_validation
    Given a task "task-1" at stage "run_validation"
    When the Sub-Agent calls mark_complete for "task-1"
    Then the tool returns a sequence_violation error
    And the error includes allowed_next ["commit"]
    And the error includes the message "You must commit after validation. Call commit next."

  # --- Rejection Response Structure ---

  Scenario: Rejection response includes full transition history
    Given a task "task-1" with transitions:
      | stage                   | at                       |
      | accept_goal             | 2026-02-10T10:00:00Z     |
      | instruct_feature_file   | 2026-02-10T10:02:00Z     |
      | commit                  | 2026-02-10T10:05:00Z     |
      | run_quality_checks      | 2026-02-10T10:06:00Z     |
    When the Sub-Agent calls instruct_implementation for "task-1"
    Then the rejection response includes the full transition_history array
    And the history contains 4 entries with timestamps

  # --- Back-Transitions ---

  Scenario: Allow going back from instruct_implementation to instruct_unit_tests
    Given a task "task-1" at stage "run_quality_checks" in context "post_implementation"
    When the Sub-Agent calls instruct_implementation for "task-1"
    Then the tool accepts the call
    And the task stage is updated to "instruct_implementation"
    And a transition is recorded from "run_quality_checks" to "instruct_implementation"

  Scenario: Allow going back from run_quality_checks (post-impl) to instruct_implementation
    Given a task "task-1" at stage "run_quality_checks" in context "post_implementation"
    And the quality checks reported failures
    When the Sub-Agent calls instruct_implementation for "task-1"
    Then the tool accepts the call
    And the pipeline resumes from instruct_implementation

  Scenario: Allow going back from run_quality_checks (post-refactor) to instruct_refactor
    Given a task "task-1" at stage "run_quality_checks" in context "post_refactor"
    And the quality checks reported failures
    When the Sub-Agent calls instruct_refactor for "task-1"
    Then the tool accepts the call

  Scenario: Allow going back from run_validation to instruct_feature_file
    Given a task "task-1" at stage "run_validation"
    When the Sub-Agent calls instruct_feature_file for "task-1"
    Then the tool accepts the call
    And the pipeline resumes from instruct_feature_file
    And the Sub-Agent must go through all subsequent stages again

  Scenario: Allow going back from run_validation to instruct_unit_tests
    Given a task "task-1" at stage "run_validation"
    When the Sub-Agent calls instruct_unit_tests for "task-1"
    Then the tool accepts the call
    And the pipeline resumes from instruct_unit_tests

  Scenario: Back-transition still requires full forward sequence afterward
    Given a task "task-1" went back from run_validation to instruct_feature_file
    When the Sub-Agent completes instruct_feature_file
    Then the next required stage is "commit"
    And after commit, the next required stage is "run_quality_checks"
    And the full pipeline sequence must be followed from that point forward

  # --- Invalid Back-Transitions ---

  Scenario: Reject backward skip that is not in the allowed set
    Given a task "task-1" at stage "instruct_step_defs"
    When the Sub-Agent calls accept_goal for "task-1"
    Then the tool returns a sequence_violation error
    And the error includes the message indicating accept_goal cannot be called again

  Scenario: Reject going back from instruct_feature_file to accept_goal
    Given a task "task-1" at stage "instruct_feature_file"
    When the Sub-Agent calls accept_goal for "task-1"
    Then the tool returns a sequence_violation error

  # --- Multiple Tasks ---

  Scenario: Multiple tasks tracked independently
    Given task "task-1" at stage "instruct_implementation" on worker "auth-worker"
    And task "task-2" at stage "instruct_feature_file" on worker "ui-worker"
    When the Sub-Agent calls commit for "task-1"
    Then "task-1" advances to "commit"
    And "task-2" remains at "instruct_feature_file"

  Scenario: Same worker can have sequential tasks
    Given task "task-1" is complete on worker "auth-worker"
    When the Sub-Agent calls accept_goal for a new task "task-2" on worker "auth-worker"
    Then "task-2" is created at stage "accept_goal"
    And "task-1" remains complete

  # --- Task Not Found ---

  Scenario: Reject pipeline call for non-existent task
    When the Sub-Agent calls instruct_feature_file for task "nonexistent-task"
    Then the tool returns an error indicating the task was not found

  # --- Completed Task ---

  Scenario: Reject pipeline calls on a completed task
    Given task "task-1" has status "complete"
    When the Sub-Agent calls instruct_feature_file for "task-1"
    Then the tool returns an error indicating the task is already complete
