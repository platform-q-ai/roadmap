Feature: Worker Messages
  As a master agent
  I want to retrieve full message history from a worker session
  So that I can read complete worker responses without truncation

  Background:
    Given a worker "msg-worker" is registered with port 5100
    And the worker "msg-worker" has sessionId "ses_msg123"
    And the OpenCode server is healthy on port 5100

  Scenario: Retrieve messages from a worker session
    Given the worker has 2 messages in its session
    When I get messages for worker "msg-worker"
    Then I should receive 2 messages
    And each message should have a role
    And each message should have content

  Scenario: Retrieve messages with a limit
    Given the worker has 10 messages in its session
    When I get the last 3 messages for worker "msg-worker"
    Then I should receive 3 messages

  Scenario: Retrieve full untruncated assistant response
    Given the worker has an assistant message with 2000 characters of text
    When I get messages for worker "msg-worker"
    Then the assistant message text should be 2000 characters long

  Scenario: Handle worker with no messages
    Given the worker has 0 messages in its session
    When I get messages for worker "msg-worker"
    Then I should receive 0 messages
