Feature: Worker Task Execution (MVP)
  The Worker receives tasks from the State Store and executes
  them using available tools via the MCP proxy.

  Background:
    Given the Worker is running with an execution system prompt
    And the MCP proxy is accessible with at least one tool

  Scenario: Receive dispatched task
    Given a task "Create login endpoint" is in "dispatched" status
    When the Worker checks for pending tasks
    Then it receives the task with description and constraints

  Scenario: Execute task with tools
    Given the Worker has received a task
    When it executes the task
    Then it makes at least one tool call via the MCP proxy
    And each tool call is logged to the State Store

  Scenario: Report task completion
    Given the Worker has finished executing a task
    When it reports results
    Then the task status is set to "complete"
    And the result summary is written to the State Store

  Scenario: Handle tool call failure
    Given the Worker is executing a task
    When a tool call returns an error
    Then the Worker logs the error
    And it attempts an alternative approach or reports failure

  Scenario: Operate within provided constraints
    Given the Worker receives a task with forbidden_actions ["delete files"]
    When it executes the task
    Then it does not call any tool that would delete files
