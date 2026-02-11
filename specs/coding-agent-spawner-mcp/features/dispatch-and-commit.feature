Feature: Dispatch and Commit Cycle
  Each BDD stage dispatches a freehand prompt to the Worker's OpenCode
  session, followed by a mandatory commit of the resulting changes.
  The Sub-Agent controls what the Worker does through its prompts.
  The enforcer controls the order and ensures every stage's output
  is committed before moving on.

  Background:
    Given the coding-agent-spawner-mcp server is running
    And a running worker named "auth-worker" with an active OpenCode session
    And a task "task-1" linked to "auth-worker"

  # --- Prompt Dispatch ---

  Scenario: instruct_feature_file dispatches prompt to Worker session
    Given task "task-1" is at stage "accept_goal"
    When the Sub-Agent calls instruct_feature_file with prompt:
      """
      Write a feature file for user login. Include scenarios for:
      - Successful login with valid credentials
      - Failed login with wrong password
      - Account locked after 5 failed attempts
      Place the file at features/login.feature
      """
    Then the prompt is sent via POST to the Worker's OpenCode session endpoint
    And the request is asynchronous (prompt_async)
    And the tool returns dispatched true and next "commit"

  Scenario: Prompt text is preserved in transition history
    When the Sub-Agent dispatches any instruct_* tool with a prompt
    Then the full prompt text is stored in the transitions table
    And can be retrieved via check_task_status

  Scenario: Dispatch fails if Worker session is unavailable
    Given the Worker's OpenCode server is not responding
    When the Sub-Agent calls instruct_feature_file for "task-1"
    Then the tool returns an error indicating the Worker session is unreachable
    And the task stage is NOT advanced
    And no transition is recorded

  Scenario: Dispatch to busy Worker is allowed
    Given the Worker is currently processing a previous prompt
    When the Sub-Agent calls instruct_feature_file for "task-1"
    Then the prompt is queued via prompt_async
    And the tool returns dispatched true
    And the Sub-Agent should use check_worker_status to wait for completion

  # --- Commit Stage ---

  Scenario: Commit after feature file instructs Worker to commit
    Given task "task-1" is at stage "instruct_feature_file"
    When the Sub-Agent calls commit with message "feat: add login feature scenarios"
    Then a prompt is dispatched to the Worker instructing it to commit with that message
    And the tool returns stage "commit", context "post_feature_file", next "run_quality_checks"

  Scenario: Commit after step definitions
    Given task "task-1" is at stage "instruct_step_defs"
    When the Sub-Agent calls commit with message "feat: add login step definitions"
    Then the commit context is "post_step_defs"
    And the next stage is "run_quality_checks"

  Scenario: Commit after unit tests
    Given task "task-1" is at stage "instruct_unit_tests"
    When the Sub-Agent calls commit with message "test: add login unit tests (red)"
    Then the commit context is "post_unit_tests"
    And the next stage is "run_quality_checks"

  Scenario: Commit after implementation
    Given task "task-1" is at stage "instruct_implementation"
    When the Sub-Agent calls commit with message "feat: implement login endpoint"
    Then the commit context is "post_implementation"
    And the next stage is "run_quality_checks"

  Scenario: Commit after refactor
    Given task "task-1" is at stage "instruct_refactor"
    When the Sub-Agent calls commit with message "refactor: extract auth validation"
    Then the commit context is "post_refactor"
    And the next stage is "run_quality_checks"

  Scenario: Commit after validation with changes
    Given task "task-1" is at stage "run_validation"
    And the Worker made changes during validation
    When the Sub-Agent calls commit with message "fix: address validation findings"
    Then the commit context is "post_validation"
    And the next stage is "mark_complete"

  Scenario: Commit after validation with no changes (no-op)
    Given task "task-1" is at stage "run_validation"
    And the Worker made no changes during validation
    When the Sub-Agent calls commit with message "no changes"
    Then the enforcer accepts the no-op commit
    And records the transition with a note "no_changes"
    And the next stage is "mark_complete"

  # --- Commit SHA Tracking ---

  Scenario: Commit SHA is recorded when available
    Given the Worker commits and produces SHA "a1b2c3d"
    When the Sub-Agent calls commit for "task-1"
    And the Sub-Agent later calls check_task_status
    Then the commit transition includes commit_sha "a1b2c3d"

  Scenario: Commit SHA may not be immediately available
    When the Sub-Agent calls commit for "task-1"
    And the Worker has not yet completed the commit
    Then the transition is recorded with commit_sha NULL
    And the SHA can be updated later when the Sub-Agent inspects the result

  # --- No Free-Form Prompting ---

  Scenario: No tool exists for sending arbitrary prompts
    Then the MCP server does not expose a "continue_worker" tool
    And the MCP server does not expose a "send_prompt" tool
    And the only way to send prompts to a Worker is through pipeline stage tools

  # --- Dispatch Order Within a Stage ---

  Scenario: Each instruct stage sends exactly one prompt
    Given task "task-1" is at stage "accept_goal"
    When the Sub-Agent calls instruct_feature_file with a prompt
    Then one prompt is sent to the Worker
    And the task advances to "instruct_feature_file"
    And calling instruct_feature_file again for "task-1" is rejected
    Because the next required stage is "commit"

  # --- Full Dispatch-Commit Cycle ---

  Scenario Outline: Each BDD stage is followed by commit then quality checks
    Given task "task-1" is ready for stage "<bdd_stage>"
    When the Sub-Agent calls <bdd_stage> with a prompt
    Then the next required call is "commit"
    And after commit, the next required call is "run_quality_checks"
    And after quality checks pass, the next required call is "<next_bdd_stage>"

    Examples:
      | bdd_stage               | next_bdd_stage          |
      | instruct_feature_file   | instruct_step_defs      |
      | instruct_step_defs      | instruct_unit_tests     |
      | instruct_unit_tests     | instruct_implementation |
      | instruct_implementation | instruct_refactor       |
      | instruct_refactor       | run_validation          |
