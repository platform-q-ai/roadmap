Feature: Shared State Store (MVP)
  The State Store is a SQLite WAL database that both agents
  read and write. It stores goals, tasks, and tool logs.

  Background:
    Given the State Store SQLite database exists

  Scenario: Create a goal
    When a goal "Build user authentication" is inserted
    Then the goal exists with status "pending"
    And the goal has a created_at timestamp

  Scenario: Create tasks for a goal
    Given a goal exists with id "goal-1"
    When tasks are inserted for goal "goal-1"
    Then each task references the parent goal
    And each task has status "pending" and an ordering index

  Scenario: Log a tool call
    Given a task exists with id "task-1"
    When a tool call log is inserted with tool "filesystem", args hash, and result hash
    Then the tool log exists with a timestamp
    And the tool log references "task-1"

  Scenario: Both agents can read/write concurrently
    Given the Meta-Agent is writing a goal
    And the Worker is writing a tool log
    Then both writes succeed without conflict
    And the WAL journal mode handles concurrent access

  Scenario: Query task status by goal
    Given a goal has 3 tasks with statuses "complete", "in-progress", "pending"
    When querying tasks for that goal
    Then all 3 tasks are returned with their statuses
