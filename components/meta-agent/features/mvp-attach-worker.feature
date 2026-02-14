Feature: Attach Worker
  As a master agent
  I want to attach a worker to an existing repository
  So that I can delegate tasks to an isolated AI coding session

  Scenario: Successfully attach a worker to a valid repository
    Given a repository exists at "/tmp/test-repo"
    And the OpenCode server starts successfully
    And the OpenCode API creates a session with id "ses_abc123"
    When I attach a worker named "my-worker" to "/tmp/test-repo" with prompt "Build the API"
    Then the worker should be registered in the registry
    And the worker should have name "my-worker"
    And the worker should have repoPath "/tmp/test-repo"
    And the worker should have sessionId "ses_abc123"
    And the worker should have status "running"
    And the worker should have the default model

  Scenario: Attach a worker with a custom model
    Given a repository exists at "/tmp/test-repo"
    And the OpenCode server starts successfully
    And the OpenCode API creates a session with id "ses_abc123"
    When I attach a worker named "custom-worker" to "/tmp/test-repo" with prompt "Build the API" and model "openai/gpt-4o"
    Then the worker should have model "openai/gpt-4o"

  Scenario: Fail to attach a worker to a non-existent repository
    Given no repository exists at "/tmp/nonexistent"
    When I try to attach a worker named "bad-worker" to "/tmp/nonexistent" with prompt "Build the API"
    Then the operation should fail with error "Repository path does not exist"
