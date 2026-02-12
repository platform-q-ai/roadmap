@v1
Feature: API Batch Feature Publishing
  As an LLM engineer working autonomously
  I want batch upload endpoints with explicit version per entry
  So that I can publish multiple feature files in a single request

  Rule: Batch uploads require an explicit version per feature entry

    Scenario: Batch upload features for a single component and version
      Given the API server is running
      And a valid API key with scope "write"
      And a component "batch-comp" exists
      When I send a POST request to "/api/components/batch-comp/versions/v1/features/batch" with body:
        """
        {
          "features": [
            {
              "filename": "first.feature",
              "content": "Feature: First\n  Scenario: S1\n    Given a step\n    When an action\n    Then a result"
            },
            {
              "filename": "second.feature",
              "content": "Feature: Second\n  Scenario: S2\n    Given another step\n    Then another result"
            }
          ]
        }
        """
      Then the response status is 201
      And the response body has field "uploaded" with value "2"
      And the response body has field "version" with value "v1"
      And the response body has field "total_steps" with value "5"
      And the response body has field "errors" as an empty array

    Scenario: Batch upload with partial validation failure
      Given the API server is running
      And a valid API key with scope "write"
      And a component "batch-partial" exists
      When I send a POST request to "/api/components/batch-partial/versions/v1/features/batch" with body:
        """
        {
          "features": [
            {
              "filename": "valid.feature",
              "content": "Feature: Valid\n  Scenario: S1\n    Given a step"
            },
            {
              "filename": "invalid.feature",
              "content": "This is not valid Gherkin"
            }
          ]
        }
        """
      Then the response status is 207
      And the response body has field "uploaded" with value "1"
      And the response body has field "errors" as an array of 1 error
      And the error references "invalid.feature"

    Scenario: Batch upload limited to 50 features
      Given the API server is running
      And a valid API key with scope "write"
      And a component "batch-limit" exists
      When I send a batch upload of 51 features to "batch-limit" version "v1"
      Then the response status is 400
      And the response body has field "error" containing "maximum 50"

    Scenario: Cross-component batch publish requires version per entry
      Given the API server is running
      And a valid API key with scope "write"
      And components "cross-1" and "cross-2" exist
      When I send a POST request to "/api/features/batch" with body:
        """
        {
          "features": [
            {
              "node_id": "cross-1",
              "version": "v1",
              "filename": "a.feature",
              "content": "Feature: A\n  Scenario: S\n    Given a step"
            },
            {
              "node_id": "cross-2",
              "version": "v2",
              "filename": "b.feature",
              "content": "Feature: B\n  Scenario: S\n    Given a step\n    Then a result"
            }
          ]
        }
        """
      Then the response status is 201
      And "cross-1" has feature "a.feature" under version "v1"
      And "cross-2" has feature "b.feature" under version "v2"

    Scenario: Cross-component batch rejects entry without version field
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/features/batch" with body:
        """
        {
          "features": [
            {
              "node_id": "some-comp",
              "filename": "no-version.feature",
              "content": "Feature: Missing Version\n  Scenario: S\n    Given a step"
            }
          ]
        }
        """
      Then the response status is 400
      And the response body has field "error" containing "version is required"

    Scenario: Batch upload with empty features array
      Given the API server is running
      And a valid API key with scope "write"
      And a component "batch-empty" exists
      When I send a POST request to "/api/components/batch-empty/versions/v1/features/batch" with body:
        """
        {
          "features": []
        }
        """
      Then the response status is 400
      And the response body has field "error" containing "features array must not be empty"

    Scenario: Batch upload rejects missing features field
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components/batch-comp/versions/v1/features/batch" with body:
        """
        {}
        """
      Then the response status is 400
      And the response body has field "error" containing "features"

    Scenario: Batch upload rejects feature entry without filename
      Given the API server is running
      And a valid API key with scope "write"
      And a component "batch-noname" exists
      When I send a POST request to "/api/components/batch-noname/versions/v1/features/batch" with body:
        """
        {
          "features": [
            {
              "content": "Feature: No Name\n  Scenario: S\n    Given a step"
            }
          ]
        }
        """
      Then the response status is 207
      And the response body has field "uploaded" with value "0"
      And the response body has field "errors" as an array of 1 error

    Scenario: Cross-component batch rejects entry without node_id
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/features/batch" with body:
        """
        {
          "features": [
            {
              "version": "v1",
              "filename": "no-node.feature",
              "content": "Feature: No Node\n  Scenario: S\n    Given a step"
            }
          ]
        }
        """
      Then the response status is 400
      And the response body has field "error" containing "node_id is required"

    Scenario: Cross-component batch rejects non-existent component
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/features/batch" with body:
        """
        {
          "features": [
            {
              "node_id": "nonexistent-comp",
              "version": "v1",
              "filename": "ghost.feature",
              "content": "Feature: Ghost\n  Scenario: S\n    Given a step"
            }
          ]
        }
        """
      Then the response status is 207
      And the response body has field "uploaded" with value "0"
      And the response body has field "errors" as an array of 1 error

    Scenario: Single-component batch rejects non-existent component
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components/no-such-comp/versions/v1/features/batch" with body:
        """
        {
          "features": [
            {
              "filename": "test.feature",
              "content": "Feature: Test\n  Scenario: S\n    Given a step"
            }
          ]
        }
        """
      Then the response status is 404
      And the response body has field "error" containing "not found"
