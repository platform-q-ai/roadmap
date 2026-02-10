Feature: Live Dashboard (MVP)
  A read-only web UI showing process status and current goal.
  Polls the Supervisor health API and State Store.

  Background:
    Given the Dashboard web app is running

  Scenario: Display process status
    Given the Supervisor health API reports Meta-Agent as "running" and Worker as "running"
    When the Dashboard polls the health API
    Then both processes are shown with "running" status indicators

  Scenario: Display current goal
    Given the State Store contains a goal "Build user auth" with status "in-progress"
    When the Dashboard polls the State Store
    Then the current goal "Build user auth" is displayed
    And its status shows "in-progress"

  Scenario: Auto-refresh on interval
    Given the Dashboard is displaying process status
    When 5 seconds have elapsed
    Then the Dashboard polls the health API again
    And the display updates with fresh data

  Scenario: Show offline state
    Given the Supervisor health API is unreachable
    When the Dashboard polls the health API
    Then a "Supervisor Unreachable" indicator is shown

  Scenario: Read-only — no mutation endpoints
    Given the Dashboard is running
    Then it exposes no POST, PUT, or DELETE endpoints
    And all data access is via GET requests
