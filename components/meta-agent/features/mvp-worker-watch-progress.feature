Feature: Watch Worker TUI Notification
  As a master agent
  I want the watch_worker background process to notify me via TUI injection
  So that I can respond to worker status changes without manual polling

  Background:
    Given a worker "progress-worker" is registered with port 5100
    And the worker "progress-worker" has sessionId "ses_prog123"
    And the OpenCode server is healthy on port 5100
    And the TUI server is available on port 4096

  Scenario: TUI injection includes worker name and status when idle
    Given the OpenCode API returns messages where the latest has no completed time
    And the worker becomes idle after 2 poll cycles
    When I start watching worker "progress-worker" with poll interval of 1 second
    And I wait for the background watcher to complete
    Then a TUI prompt should have been injected
    And the injected prompt should contain "progress-worker"
    And the injected prompt should contain "idle"

  Scenario: TUI injection includes file change summary
    Given the OpenCode API returns messages where the latest has no completed time
    And the worker becomes idle after 1 poll cycles
    And the OpenCode API returns diff with 5 files changed
    When I start watching worker "progress-worker" with poll interval of 1 second
    And I wait for the background watcher to complete
    Then a TUI prompt should have been injected
    And the injected prompt should contain "5 files changed"

  Scenario: TUI injection includes last message preview
    Given the OpenCode API returns messages where the latest has no completed time
    And the worker becomes idle after 1 poll cycles
    When I start watching worker "progress-worker" with poll interval of 1 second
    And I wait for the background watcher to complete
    Then a TUI prompt should have been injected
    And the injected prompt should contain the last assistant message
