Feature: Meta-Agent Planning Loop (MVP)
  The Meta-Agent reads goals, decomposes them into tasks,
  and dispatches work to the Worker via the State Store.

  Background:
    Given the Meta-Agent is running with a planning system prompt
    And the State Store is accessible

  Scenario: Read next goal from queue
    Given the goal queue contains "Build user authentication"
    When the Meta-Agent checks the goal queue
    Then it receives the goal "Build user authentication"
    And the goal status is set to "in-progress"

  Scenario: Decompose goal into tasks
    Given the Meta-Agent has received the goal "Build user authentication"
    When it decomposes the goal
    Then the State Store contains at least 2 sub-tasks
    And each sub-task has a description and ordering

  Scenario: Dispatch task to Worker
    Given a sub-task "Create login endpoint" exists in the State Store
    When the Meta-Agent dispatches the task
    Then the task status is set to "dispatched"
    And the task includes a description and success criteria

  Scenario: Read Worker progress
    Given a task has been dispatched to the Worker
    When the Meta-Agent checks Worker progress
    Then it receives the latest checkpoint for that task
    And the checkpoint includes tool calls made and their results

  Scenario: Complete goal when all tasks done
    Given all sub-tasks for a goal are in "complete" status
    When the Meta-Agent evaluates the goal
    Then the goal status is set to "complete"
    And the Meta-Agent reads the next goal from the queue
