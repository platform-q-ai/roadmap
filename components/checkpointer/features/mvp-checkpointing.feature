Feature: Checkpointer (MVP)
  The Checkpointer taps the Worker's MCP proxy and records
  every tool call for crash recovery and progress tracking.

  Background:
    Given the Checkpointer is attached to the Worker's MCP proxy
    And the State Store is accessible

  Scenario: Record tool call after response
    Given the Worker calls the "filesystem" tool with args "read file.ts"
    When the tool returns a successful response
    Then the Checkpointer writes a record to the State Store
    And the record includes task_id, tool_name, args_hash, result_hash, and timestamp

  Scenario: Non-blocking operation
    Given the Worker is executing a task
    When a tool call completes
    Then the Checkpointer writes asynchronously
    And the Worker does not wait for the checkpoint write

  Scenario: Maintain ordering of tool calls
    Given the Worker makes 3 sequential tool calls
    When all 3 are checkpointed
    Then the records are ordered by timestamp
    And each has a sequential index within the task

  Scenario: Handle write failure gracefully
    Given the State Store is temporarily unavailable
    When the Checkpointer attempts to write
    Then it retries with backoff
    And the Worker execution is not affected
