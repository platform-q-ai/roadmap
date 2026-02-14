Feature: Worker Communication
  As a master agent
  I want to send messages to workers and check their status
  So that I can interact with and monitor worker progress

  Background:
    Given a worker "comm-worker" is registered with port 5100
    And the worker "comm-worker" has sessionId "ses_comm123"
    And the OpenCode server is healthy on port 5100

  Scenario: Send a follow-up message to a worker
    Given the OpenCode API accepts prompt requests
    When I send message "Fix the tests" to worker "comm-worker"
    Then the response should have status "message_sent"

  Scenario: Check status of a busy worker
    Given the OpenCode API returns messages where the latest has no completed time
    And the OpenCode API returns diff with 3 files changed
    When I check the status of worker "comm-worker"
    Then the worker should be busy
    And the worker should have 3 files changed

  Scenario: Check status of an idle worker
    Given the OpenCode API returns messages where the latest is completed
    And the last assistant message is "All tests passing now"
    And the OpenCode API returns diff with 0 files changed
    When I check the status of worker "comm-worker"
    Then the worker should not be busy
    And the last message should be "All tests passing now"

  Scenario: Set worker model
    When I set the model of worker "comm-worker" to "anthropic/claude-sonnet-4-20250514"
    Then the worker should have model "anthropic/claude-sonnet-4-20250514"
