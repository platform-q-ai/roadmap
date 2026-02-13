@v1
Feature: API Version Management
  As an LLM engineer using the roadmap API headlessly
  I want endpoints to manage component versions with step-based progress
  So that I can track lifecycle state and progress for each version tier

  Background:
    Given the API server is running

  # ── List versions ─────────────────────────────────────────────────

  Scenario: List versions for a component
    Given component "ver-list" has versions "overview", "mvp", "v1", "v2"
    When I send a GET request to "/api/components/ver-list/versions"
    Then the response status is 200
    And the response body is an array of 4 items
    And each version object has fields "version", "content", "progress", "status", "updated_at"
    And each phase version includes step-based progress fields

  Scenario: List versions for nonexistent component returns 404
    When I send a GET request to "/api/components/ghost-comp/versions"
    Then the response status is 404
    And the response body has field "error"

  # ── Get single version ────────────────────────────────────────────

  Scenario: Get a single version for a component
    Given component "ver-single" has version "mvp" with progress 75
    When I send a GET request to "/api/components/ver-single/versions/mvp"
    Then the response status is 200
    And the response body has field "version" with value "mvp"
    And the response body has field "progress" with value "75"

  Scenario: Get nonexistent version returns 404
    Given component "ver-miss" exists
    When I send a GET request to "/api/components/ver-miss/versions/v99"
    Then the response status is 404
    And the response body has field "error"

  Scenario: Get version for nonexistent component returns 404
    When I send a GET request to "/api/components/ghost-comp/versions/mvp"
    Then the response status is 404
    And the response body has field "error"

  # ── Create or update version ──────────────────────────────────────

  Scenario: Create or update version content
    Given component "ver-upsert" exists
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

  # ── Delete all versions ───────────────────────────────────────────

  Scenario: Delete all versions for a component
    Given component "ver-del" has versions "overview", "mvp", "v1"
    When I send a DELETE request to "/api/components/ver-del/versions"
    Then the response status is 204

  Scenario: Delete all versions for nonexistent component returns 404
    When I send a DELETE request to "/api/components/ghost-comp/versions"
    Then the response status is 404

  # ── Step-based progress ───────────────────────────────────────────

  Scenario: Version progress reflects step-based calculation
    Given component "step-ver" has version "v1" with 40 total steps and 30 passing
    When I send a GET request to "/api/components/step-ver/versions/v1"
    Then the response status is 200
    And the response body has field "total_steps" with value "40"
    And the response body has field "passing_steps" with value "30"
    And the response body has field "step_progress" with value "75"
