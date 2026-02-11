Feature: Task State Management
  All pipeline state is persisted in SQLite. State transitions are
  atomic — validation and update happen in a single transaction.
  The database tracks tasks, transitions, and workers, replacing
  the JSON registry from worker-spawner-mcp.

  Background:
    Given the coding-agent-spawner-mcp server is running
    And the SQLite database exists at "~/.coding-agent-spawner/state.db"

  # --- Database Initialization ---

  Scenario: Database is created on first run
    Given the directory "~/.coding-agent-spawner" does not exist
    When the coding-agent-spawner-mcp server starts
    Then the directory "~/.coding-agent-spawner" is created
    And "state.db" is created with tables: tasks, transitions, workers

  Scenario: Database schema matches specification
    When the database is inspected
    Then the tasks table has columns: id, goal, type, worker_name, current_stage, status, created_at, updated_at
    And the transitions table has columns: id, task_id, from_stage, to_stage, prompt, commit_sha, quality_results, worker_response_summary, created_at
    And the workers table has columns: name, session_id, repo_path, model, server_port, server_pid, status, created_at

  Scenario: Existing database is reused on restart
    Given the database already exists with tasks and workers
    When the coding-agent-spawner-mcp server restarts
    Then all existing data is preserved
    And the server resumes tracking from the persisted state

  # --- Task Creation ---

  Scenario: accept_goal creates a task record
    Given a running worker named "auth-worker"
    When the Sub-Agent calls accept_goal with goal "Add login endpoint", type "greenfield", worker "auth-worker"
    Then a new row is inserted into the tasks table
    And the task has a generated UUID as id
    And the task has current_stage "accept_goal"
    And the task has status "active"
    And created_at and updated_at are set to the current timestamp

  Scenario: accept_goal creates the first transition
    When the Sub-Agent calls accept_goal
    Then a transition is recorded with from_stage NULL and to_stage "accept_goal"
    And the transition prompt contains the goal text

  # --- Atomic State Transitions ---

  Scenario: Stage transition is atomic
    Given a task "task-1" at stage "accept_goal"
    When the Sub-Agent calls instruct_feature_file for "task-1"
    Then the following happen in a single SQLite transaction:
      | operation                                          |
      | Validate current_stage allows instruct_feature_file |
      | Update tasks.current_stage to "instruct_feature_file" |
      | Update tasks.updated_at to current timestamp        |
      | Insert a new transition row                         |

  Scenario: Failed validation does not modify state
    Given a task "task-1" at stage "accept_goal"
    When the Sub-Agent calls instruct_implementation for "task-1" (invalid)
    Then no rows in tasks or transitions are modified
    And the task remains at stage "accept_goal"

  # --- Transition History ---

  Scenario: Every stage change is recorded as a transition
    Given a task "task-1" that has gone through 8 stages
    When the transitions table is queried for "task-1"
    Then 8 transition rows exist
    And each has a created_at timestamp
    And they are ordered by id ascending

  Scenario: Transition records the prompt sent to the Worker
    Given a task "task-1" at stage "accept_goal"
    When the Sub-Agent calls instruct_feature_file with prompt "Write login scenarios"
    Then the transition row for instruct_feature_file has prompt "Write login scenarios"

  Scenario: Commit transitions record the commit SHA
    Given a task "task-1" at stage "instruct_feature_file"
    When the Sub-Agent calls commit and the Worker produces commit SHA "abc123f"
    Then the transition row for commit has commit_sha "abc123f"

  Scenario: Quality check transitions record results
    Given a task "task-1" at stage "commit" in context "post_feature_file"
    When the Sub-Agent calls run_quality_checks and the checks complete
    Then the transition row for run_quality_checks has quality_results as a JSON object
    And the JSON contains the check names, pass/fail status, and any output

  # --- Context Tracking ---

  Scenario: Commit stages track which BDD stage they follow
    Given a task "task-1" has just completed instruct_feature_file
    When the Sub-Agent calls commit for "task-1"
    Then the transition from_stage is "instruct_feature_file"
    And the enforcer records the commit context as "post_feature_file"

  Scenario: Quality check stages track which commit they follow
    Given a task "task-1" has just committed after instruct_unit_tests
    When the Sub-Agent calls run_quality_checks for "task-1"
    Then the enforcer knows these checks follow the unit test commit
    And applies the appropriate check suite for post-test validation

  # --- Task Status Lifecycle ---

  Scenario: Task status transitions
    When a task goes through its full lifecycle
    Then the status transitions are:
      | stage          | status   |
      | accept_goal    | active   |
      | mark_complete  | complete |

  Scenario: Task can be marked as failed
    Given a task "task-1" at any stage
    When the task encounters an unrecoverable error
    Then the task status can be updated to "failed"
    And no further pipeline calls are accepted

  Scenario: Task can be cancelled
    Given a task "task-1" at any stage with status "active"
    When the task is cancelled
    Then the task status is updated to "cancelled"
    And no further pipeline calls are accepted

  # --- check_task_status Tool ---

  Scenario: Check task status returns current state and history
    Given a task "task-1" at stage "instruct_implementation" with 10 transitions
    When the Sub-Agent calls check_task_status for "task-1"
    Then the tool returns:
      | field               | value                    |
      | task_id             | task-1                   |
      | goal                | the original goal text   |
      | type                | greenfield               |
      | current_stage       | instruct_implementation  |
      | status              | active                   |
      | worker              | auth-worker              |
      | allowed_next        | [commit]                 |
      | transition_count    | 10                       |
      | transitions         | array of all 10 entries  |
      | created_at          | task creation timestamp  |
      | duration            | elapsed time since creation |

  Scenario: Check task status for non-existent task
    When the Sub-Agent calls check_task_status for "nonexistent-task"
    Then the tool returns an error indicating the task was not found

  # --- Worker Registry in SQLite ---

  Scenario: Worker registration persists across server restarts
    Given a worker "auth-worker" was spawned before a server restart
    When the server restarts and the Sub-Agent calls list_workers
    Then "auth-worker" appears in the list with its original registration data

  Scenario: Worker state is updated atomically
    When a worker's status changes from "idle" to "running"
    Then the workers table is updated in a single transaction
    And concurrent reads see either the old or new state, never a partial update

  # --- Back-Transition State ---

  Scenario: Back-transition resets current_stage correctly
    Given a task "task-1" at stage "run_validation"
    When the Sub-Agent calls instruct_feature_file for "task-1" (back-transition)
    Then tasks.current_stage is updated to "instruct_feature_file"
    And a transition is recorded from "run_validation" to "instruct_feature_file"
    And the previous forward transitions are preserved in history (not deleted)
    And the task still has status "active"

  Scenario: Transition history shows back-transitions
    Given a task with the following transitions:
      | from                  | to                      |
      | NULL                  | accept_goal             |
      | accept_goal           | instruct_feature_file   |
      | instruct_feature_file | commit                  |
      | commit                | run_quality_checks      |
      | run_quality_checks    | instruct_step_defs      |
      | instruct_step_defs    | commit                  |
      | commit                | run_quality_checks      |
      | run_quality_checks    | instruct_unit_tests     |
      | instruct_unit_tests   | commit                  |
      | commit                | run_quality_checks      |
      | run_quality_checks    | instruct_implementation |
      | instruct_implementation | commit                |
      | commit                | run_quality_checks      |
      | run_quality_checks    | instruct_implementation |
    When the Sub-Agent calls check_task_status
    Then the history shows the back-transition from run_quality_checks to instruct_implementation
    And the total transition count is 14
