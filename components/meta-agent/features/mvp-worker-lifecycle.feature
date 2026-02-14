Feature: Worker Lifecycle
  As a master agent
  I want to manage the lifecycle of workers
  So that I can start, stop, and remove workers as needed

  Background:
    Given a worker "lifecycle-worker" is registered with port 5100

  Scenario: List all workers
    When I list all workers
    Then I should see 1 worker
    And the worker list should include "lifecycle-worker"

  Scenario: Stop a worker by name
    When I stop the worker "lifecycle-worker"
    Then the worker should have status "stopped"

  Scenario: Remove a worker
    When I remove the worker "lifecycle-worker"
    Then the worker should be removed from the registry
    And the worker repository should not be deleted

  Scenario: Health check with all workers healthy
    Given the worker "lifecycle-worker" server is healthy
    When I run a health check
    Then the summary should be "1/1 healthy"

  Scenario: Health check with unhealthy worker
    Given the worker "lifecycle-worker" server is not healthy
    And the worker "lifecycle-worker" process is not running
    When I run a health check
    Then the summary should be "0/1 healthy"
    And the worker should have issue "Server process not running (crashed or killed)"

  Scenario: Health check with fix for crashed worker
    Given the worker "lifecycle-worker" server is not healthy
    And the worker "lifecycle-worker" process is not running
    When I run a health check with fix enabled
    Then the worker should be fixed
