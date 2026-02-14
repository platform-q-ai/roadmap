Feature: Worker Repository Access
  As a master agent
  I want to read files and search content in worker repositories
  So that I can inspect worker output without modifying anything

  Background:
    Given a worker "repo-worker" is registered with repoPath "/tmp/test-repo"

  Scenario: Read a file from worker repo
    Given the file "README.md" exists in the worker repo with content "# Hello World"
    When I read file "README.md" from worker "repo-worker"
    Then the file content should be "# Hello World"

  Scenario: Prevent path traversal attack
    When I try to read file "../../etc/passwd" from worker "repo-worker"
    Then the operation should fail with error "Path traversal not allowed"

  Scenario: Find files by glob pattern
    Given the worker repo contains files "src/index.ts" and "src/utils.ts"
    When I glob pattern "src/**/*.ts" in worker "repo-worker"
    Then I should find 2 files

  Scenario: Search file contents by regex
    Given the worker repo contains a file with "TODO: fix this" in it
    When I grep for "TODO" with file pattern "*.ts" in worker "repo-worker"
    Then I should find matching lines

  Scenario: Grep returns empty when no matches
    Given the worker repo contains no matching content
    When I grep for "NONEXISTENT" with file pattern "*.ts" in worker "repo-worker"
    Then I should find no matching lines
