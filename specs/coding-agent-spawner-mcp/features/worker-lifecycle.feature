Feature: Worker Lifecycle Management
  The Coding Sub-Agent manages isolated Worker agents — spawning them
  with scaffolded repos, stopping them, removing them, and monitoring
  their health. Workers start idle (no initial task prompt) and receive
  their first instructions through the BDD pipeline.

  Background:
    Given the coding-agent-spawner-mcp server is running
    And the OpenCode CLI is available on the system

  # --- Spawning ---

  Scenario: Spawn a new worker with default model
    When the Sub-Agent calls spawn_worker with name "auth-worker" and template "api"
    Then a new project is scaffolded at "~/Documents/agent-projects/auth-worker"
    And an OpenCode server is started on an available port
    And the server becomes healthy within 30 seconds
    And a new OpenCode session is created for the worker
    And the worker is registered in SQLite with status "idle"
    And no initial prompt is sent to the worker
    And the tool returns the worker name, session ID, repo path, port, and status "idle"

  Scenario: Spawn a worker with a specific model
    When the Sub-Agent calls spawn_worker with name "ui-worker", template "frontend", and model "anthropic/claude-sonnet-4-20250514"
    Then the worker's OpenCode config is set to use "anthropic/claude-sonnet-4-20250514"
    And the worker is registered with model "anthropic/claude-sonnet-4-20250514"

  Scenario: Spawn fails if name already exists
    Given a worker named "auth-worker" is already registered
    When the Sub-Agent calls spawn_worker with name "auth-worker" and template "api"
    Then the tool returns an error indicating the worker name is already in use

  Scenario: Spawn assigns incrementing ports starting from base
    Given no workers are currently registered
    When the Sub-Agent spawns workers named "worker-a", "worker-b", "worker-c"
    Then they are assigned ports 5100, 5101, 5102 respectively

  Scenario: Spawn assigns next available port when gaps exist
    Given a worker on port 5100 and a worker on port 5102 exist
    When the Sub-Agent spawns a new worker
    Then it is assigned port 5101

  # --- Model Configuration ---

  Scenario: Change a worker's model
    Given a running worker named "auth-worker"
    When the Sub-Agent calls set_worker_model with worker "auth-worker" and model "anthropic/claude-haiku-4-20250414"
    Then the worker's OpenCode config is updated to "anthropic/claude-haiku-4-20250414"
    And the worker registry reflects the new model

  # --- Stopping ---

  Scenario: Stop a running worker
    Given a running worker named "auth-worker" on port 5100 with PID 12345
    When the Sub-Agent calls stop_worker with worker "auth-worker"
    Then the OpenCode server process is terminated
    And the worker status is updated to "stopped" in the registry
    And the worker's repo is preserved on disk

  Scenario: Stop an already stopped worker
    Given a worker named "auth-worker" with status "stopped"
    When the Sub-Agent calls stop_worker with worker "auth-worker"
    Then the tool returns success with a note that the worker was already stopped

  # --- Removal ---

  Scenario: Remove a worker without deleting the repo
    Given a running worker named "auth-worker"
    When the Sub-Agent calls remove_worker with worker "auth-worker" and delete_repo false
    Then the OpenCode server is stopped
    And the worker is removed from the registry
    And the project directory is preserved at "~/Documents/agent-projects/auth-worker"

  Scenario: Remove a worker and delete the repo
    Given a running worker named "auth-worker" at "~/Documents/agent-projects/auth-worker"
    When the Sub-Agent calls remove_worker with worker "auth-worker" and delete_repo true
    Then the OpenCode server is stopped
    And the worker is removed from the registry
    And the directory "~/Documents/agent-projects/auth-worker" is deleted

  Scenario: Remove fails for non-existent worker
    When the Sub-Agent calls remove_worker with worker "ghost-worker"
    Then the tool returns an error indicating the worker was not found

  # --- Listing ---

  Scenario: List all workers
    Given workers "auth-worker" (running), "ui-worker" (idle), and "old-worker" (stopped) exist
    When the Sub-Agent calls list_workers
    Then the tool returns all three workers with their name, session ID, repo path, status, and any active task IDs

  Scenario: List workers when none exist
    Given no workers are registered
    When the Sub-Agent calls list_workers
    Then the tool returns an empty list

  # --- Health Checks ---

  Scenario: Health check detects a crashed server
    Given a worker named "auth-worker" is registered with status "running"
    But the OpenCode server process has exited
    When the Sub-Agent calls health_check
    Then the tool reports "auth-worker" as unhealthy with diagnosis "server process not running"

  Scenario: Health check auto-restarts crashed servers
    Given a worker named "auth-worker" is registered with status "running"
    But the OpenCode server process has exited
    When the Sub-Agent calls health_check with fix true
    Then a new OpenCode server is started for "auth-worker"
    And the server becomes healthy within 30 seconds
    And the worker's PID is updated in the registry
    And the tool reports "auth-worker" as fixed

  Scenario: Health check reports all healthy
    Given all registered workers have healthy OpenCode servers
    When the Sub-Agent calls health_check
    Then the tool reports all workers as healthy

  Scenario: Health check detects zombie process on port
    Given a worker named "auth-worker" is registered on port 5100
    And a process other than the registered PID is listening on port 5100
    When the Sub-Agent calls health_check with fix true
    Then the zombie process on port 5100 is killed
    And a fresh OpenCode server is started for "auth-worker"

  # --- Worker Resolution ---

  Scenario: Resolve worker by name
    Given a worker named "auth-worker" with session ID "sess-abc-123"
    When any tool is called with worker "auth-worker"
    Then the worker is resolved to the "auth-worker" registry entry

  Scenario: Resolve worker by session ID
    Given a worker named "auth-worker" with session ID "sess-abc-123"
    When any tool is called with worker "sess-abc-123"
    Then the worker is resolved to the "auth-worker" registry entry

  Scenario: Resolution fails for unknown identifier
    When any tool is called with worker "unknown-worker"
    Then the tool returns an error indicating the worker was not found
