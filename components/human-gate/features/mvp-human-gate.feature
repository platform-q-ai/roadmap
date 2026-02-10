Feature: Human Gate (MVP)
  The Human Gate provides an approval queue for dangerous
  operations and a write fence for destructive actions.

  Background:
    Given the Human Gate is running

  Scenario: Block destructive operation for approval
    Given the write fence includes "database drop" operations
    When a task requests a database drop
    Then the task is paused with status "awaiting_approval"
    And the approval request is added to the queue

  Scenario: Approve pending request
    Given a task is paused awaiting approval
    When a human approves the request
    Then the task status changes to "approved"
    And execution resumes

  Scenario: Reject pending request
    Given a task is paused awaiting approval
    When a human rejects the request
    Then the task status changes to "rejected"
    And the task is aborted

  Scenario: Timeout on unanswered request
    Given a task has been awaiting approval for longer than the timeout
    When the timeout expires
    Then the task is aborted
    And the timeout event is logged
