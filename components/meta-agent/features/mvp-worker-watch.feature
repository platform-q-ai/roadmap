Feature: Watch Worker
  As a master agent
  I want to start a background watch on a worker and be notified via TUI prompt injection when it becomes idle
  So that I don't block the conversation while waiting

  Background:
    Given a worker "watch-worker" is registered with port 5100
    And the worker "watch-worker" has sessionId "ses_watch123"
    And the OpenCode server is healthy on port 5100

  Scenario: Watch returns immediately with watching status
    When I start watching worker "watch-worker" with poll interval of 30 seconds
    Then the tool should return immediately
    And the response should have status "watching"
    And the response should include the worker name "watch-worker"

  Scenario: Background watcher injects TUI prompt when worker becomes idle
    Given the TUI server is available on port 4096
    And the OpenCode API returns messages where the latest has no completed time
    And the worker becomes idle after 2 poll cycles
    When I start watching worker "watch-worker" with poll interval of 1 second
    And I wait for the background watcher to complete
    Then a TUI prompt should have been injected
    And the injected prompt should contain the worker status

  Scenario: Background watcher injects TUI prompt on timeout
    Given the TUI server is available on port 4096
    And the OpenCode API returns messages where the latest has no completed time
    And the worker remains busy indefinitely
    When I start watching worker "watch-worker" with poll interval of 1 second and timeout of 3 seconds
    And I wait for the background watcher to complete
    Then a TUI prompt should have been injected
    And the injected prompt should mention timeout

  Scenario: Watch can be cancelled
    When I start watching worker "watch-worker" with poll interval of 30 seconds
    And I cancel the watch for worker "watch-worker"
    Then the watch should be stopped
    And no TUI prompt should have been injected
