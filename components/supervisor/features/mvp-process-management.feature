Feature: Supervisor Process Management (MVP)
  The Supervisor spawns and monitors child processes.
  It detects crashes and restarts children with basic retry logic.

  Background:
    Given the Supervisor process is running

  Scenario: Spawn child processes on startup
    When the Supervisor starts
    Then it spawns the Meta-Agent process
    And it spawns the Worker process
    And both processes are in "running" state

  Scenario: Detect child crash via waitpid
    Given the Meta-Agent process is running
    When the Meta-Agent process exits unexpectedly
    Then the Supervisor detects the exit within 100ms
    And the exit is logged with the process ID and exit code

  Scenario: Restart crashed child
    Given the Worker process has crashed
    When the Supervisor detects the crash
    Then it restarts the Worker process
    And the new process is in "running" state
    And the restart count is incremented

  Scenario: Respect maximum retry limit
    Given the Worker has crashed 5 times consecutively
    When the Worker crashes again
    Then the Supervisor does not restart the Worker
    And the Worker state is set to "failed"
    And an alert is logged

  Scenario: Health API returns process status
    Given both child processes are running
    When a GET request is made to /health
    Then the response status is 200
    And the response body contains status for each child process
    And each status includes "pid", "state", and "uptime"

  Scenario: Graceful shutdown on SIGTERM
    Given both child processes are running
    When the Supervisor receives SIGTERM
    Then it sends SIGTERM to all child processes
    And it waits for children to exit
    And it exits with code 0
