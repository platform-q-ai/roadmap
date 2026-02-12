@wip @v1
Feature: API Version Management
  As an LLM engineer using the roadmap API headlessly
  I want endpoints to manage component versions with step-based progress
  So that I can track lifecycle state and progress for each version tier

  Rule: Component versions can be managed via the API

    Scenario: List versions for a component
      Given the API server is running
      And a valid API key with scope "read"
      And component "ver-list" has versions "overview", "mvp", "v1", "v2"
      When I send a GET request to "/api/components/ver-list/versions"
      Then the response status is 200
      And the response body is an array of 4 version objects
      And each version has fields: version, content, progress, status, updated_at
      And each phase version (mvp, v1, v2) includes step-based progress fields:
        | field          | description                              |
        | total_steps    | Total Given/When/Then steps for version  |
        | passing_steps  | Steps in passing scenarios               |
        | step_progress  | passing_steps / total_steps * 100        |

    Scenario: Get a single version for a component
      Given the API server is running
      And a valid API key with scope "read"
      And component "ver-single" has version "mvp" with progress 75
      When I send a GET request to "/api/components/ver-single/versions/mvp"
      Then the response status is 200
      And the response body has field "version" with value "mvp"
      And the response body has field "progress" with value "75"

    Scenario: Create or update version content
      Given the API server is running
      And a valid API key with scope "write"
      And component "ver-upsert" exists
      When I send a PUT request to "/api/components/ver-upsert/versions/v1" with body:
        """
        {
          "content": "V1 adds Neo4j storage, secure API, and feature-driven progress tracking.",
          "progress": 0,
          "status": "planned"
        }
        """
      Then the response status is 200
      And the response body has field "version" with value "v1"
      And the response body has field "content"

    Scenario: Delete all versions for a component
      Given the API server is running
      And a valid API key with scope "write"
      And component "ver-del" has versions "overview", "mvp", "v1"
      When I send a DELETE request to "/api/components/ver-del/versions"
      Then the response status is 204
      And no versions exist for "ver-del"

    Scenario: Version progress reflects step-based calculation
      Given the API server is running
      And a valid API key with scope "read"
      And component "step-ver" has version "v1" with 40 total steps and 30 passing
      When I send a GET request to "/api/components/step-ver/versions/v1"
      Then the response status is 200
      And the response body has field "total_steps" with value "40"
      And the response body has field "passing_steps" with value "30"
      And the response body has field "step_progress" with value "75"
      And the response body has field "progress" reflecting the combined weighted value
