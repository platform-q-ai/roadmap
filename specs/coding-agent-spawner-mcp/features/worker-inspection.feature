Feature: Worker Inspection
  The Coding Sub-Agent can inspect Worker repos and OpenCode sessions
  in read-only mode. This allows the Sub-Agent to assess progress,
  review output, and make informed decisions about the next pipeline
  stage — without being able to modify the Worker's codebase directly.

  Background:
    Given the coding-agent-spawner-mcp server is running
    And a running worker named "auth-worker" exists
    And the worker's repo is at "~/Documents/agent-projects/auth-worker"

  # --- Status Checking ---

  Scenario: Check status of an idle worker
    Given the worker has no active task
    And the worker's OpenCode session has no recent messages
    When the Sub-Agent calls check_worker_status with worker "auth-worker"
    Then the tool returns status "idle", busy false, and no active task

  Scenario: Check status of a busy worker
    Given the worker is processing a prompt
    And the latest message has no completion timestamp
    When the Sub-Agent calls check_worker_status with worker "auth-worker"
    Then the tool returns busy true
    And the last message preview is truncated to 500 characters

  Scenario: Check status includes file change stats
    Given the worker has made changes in the current session
    When the Sub-Agent calls check_worker_status with worker "auth-worker"
    Then the tool returns files_changed, additions, and deletions counts

  Scenario: Check status includes active pipeline task
    Given the worker has an active task "task-abc" at stage "instruct_implementation"
    When the Sub-Agent calls check_worker_status with worker "auth-worker"
    Then the tool returns active_task with task_id "task-abc" and stage "instruct_implementation"

  Scenario: Check status when OpenCode API is unreachable
    Given the worker's OpenCode server is not responding
    When the Sub-Agent calls check_worker_status with worker "auth-worker"
    Then the tool returns basic registry info with a note that the session API is unavailable

  # --- File Reading ---

  Scenario: Read a file from the worker repo
    Given the worker repo contains "src/auth/login.ts" with content "export function login() {}"
    When the Sub-Agent calls read_worker_file with worker "auth-worker" and file_path "src/auth/login.ts"
    Then the tool returns the file content "export function login() {}"

  Scenario: Read a non-existent file
    When the Sub-Agent calls read_worker_file with worker "auth-worker" and file_path "src/nonexistent.ts"
    Then the tool returns an error indicating the file was not found

  Scenario: Path traversal is blocked
    When the Sub-Agent calls read_worker_file with worker "auth-worker" and file_path "../../etc/passwd"
    Then the tool returns an error "Path traversal not allowed"
    And no file outside the worker repo is accessed

  Scenario: Read a file with special characters in the path
    Given the worker repo contains "src/utils/my-helper.test.ts"
    When the Sub-Agent calls read_worker_file with worker "auth-worker" and file_path "src/utils/my-helper.test.ts"
    Then the tool returns the file content successfully

  # --- Glob Search ---

  Scenario: Find files by glob pattern
    Given the worker repo contains:
      | path                        |
      | src/auth/login.ts           |
      | src/auth/register.ts        |
      | src/auth/login.test.ts      |
      | src/utils/hash.ts           |
    When the Sub-Agent calls glob_worker with worker "auth-worker" and pattern "src/auth/**/*.ts"
    Then the tool returns:
      | path                        |
      | src/auth/login.ts           |
      | src/auth/register.ts        |
      | src/auth/login.test.ts      |

  Scenario: Glob returns empty for no matches
    When the Sub-Agent calls glob_worker with worker "auth-worker" and pattern "*.py"
    Then the tool returns an empty list

  Scenario: Find feature files
    Given the worker repo contains:
      | path                                |
      | features/login.feature              |
      | features/registration.feature       |
      | src/steps/login.steps.ts            |
    When the Sub-Agent calls glob_worker with worker "auth-worker" and pattern "**/*.feature"
    Then the tool returns:
      | path                                |
      | features/login.feature              |
      | features/registration.feature       |

  # --- Content Search ---

  Scenario: Search for a pattern in source files
    Given the worker repo contains "src/auth/login.ts" with content:
      """
      export function login(username: string, password: string) {
        if (!username) throw new Error('Username required');
        return authenticate(username, password);
      }
      """
    When the Sub-Agent calls grep_worker with worker "auth-worker", pattern "throw new Error", and file_pattern "*.ts"
    Then the tool returns a match in "src/auth/login.ts" at the line containing "throw new Error"

  Scenario: Search returns empty for no matches
    When the Sub-Agent calls grep_worker with worker "auth-worker", pattern "NONEXISTENT_PATTERN_XYZ", and file_pattern "*.ts"
    Then the tool returns an empty list

  Scenario: Search with regex pattern
    When the Sub-Agent calls grep_worker with worker "auth-worker", pattern "function\s+\w+\(", and file_pattern "*.ts"
    Then the tool returns matches for all function declarations in TypeScript files

  # --- Inspection Does Not Mutate ---

  Scenario: All inspection tools are read-only
    Given the worker repo contains "src/auth/login.ts"
    When the Sub-Agent calls read_worker_file, glob_worker, and grep_worker
    Then no files in the worker repo are created, modified, or deleted
    And no prompts are sent to the Worker's OpenCode session
