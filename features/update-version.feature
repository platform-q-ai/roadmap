Feature: Update version descriptions via API
  As an LLM engineer using the roadmap API headlessly
  I want to update MVP, v1, and v2 version descriptions for components
  So that I can programmatically maintain version documentation via the API

  Background:
    Given the API server is running

  # ── Happy path ──────────────────────────────────────────────────────

  Scenario: Update the MVP version content for a component
    Given a component "uv-comp" exists in the database
    When I send a PUT request to "/api/components/uv-comp/versions/mvp" with body:
      """
      {"content":"Updated MVP description with new details."}
      """
    Then the response status is 200
    And the response body has field "version" with value "mvp"
    And the response body has field "content" with value "Updated MVP description with new details."
    And the response body has field "node_id" with value "uv-comp"

  Scenario: Update the v1 version content for a component
    Given a component "uv-v1" exists in the database
    When I send a PUT request to "/api/components/uv-v1/versions/v1" with body:
      """
      {"content":"V1 adds secure API, Neo4j storage, and feature-driven progress."}
      """
    Then the response status is 200
    And the response body has field "version" with value "v1"
    And the response body has field "content" with value "V1 adds secure API, Neo4j storage, and feature-driven progress."

  Scenario: Update the v2 version content for a component
    Given a component "uv-v2" exists in the database
    When I send a PUT request to "/api/components/uv-v2/versions/v2" with body:
      """
      {"content":"V2 introduces self-evolution and knowledge curation."}
      """
    Then the response status is 200
    And the response body has field "version" with value "v2"

  Scenario: Update version progress and status alongside content
    Given a component "uv-prog" exists in the database
    When I send a PUT request to "/api/components/uv-prog/versions/mvp" with body:
      """
      {"content":"MVP in progress.","progress":50,"status":"in-progress"}
      """
    Then the response status is 200
    And the response body has field "progress" with value "50"
    And the response body has field "status" with value "in-progress"

  Scenario: Update only content without changing progress or status
    Given a component "uv-partial" exists in the database
    When I send a PUT request to "/api/components/uv-partial/versions/mvp" with body:
      """
      {"content":"Just updating the description."}
      """
    Then the response status is 200
    And the response body has field "content" with value "Just updating the description."

  Scenario: Update the overview version content
    Given a component "uv-overview" exists in the database
    When I send a PUT request to "/api/components/uv-overview/versions/overview" with body:
      """
      {"content":"Updated overview description."}
      """
    Then the response status is 200
    And the response body has field "version" with value "overview"

  # ── Error cases ─────────────────────────────────────────────────────

  Scenario: Update version for nonexistent component returns 404
    When I send a PUT request to "/api/components/ghost-comp/versions/mvp" with body:
      """
      {"content":"Should fail."}
      """
    Then the response status is 404
    And the response body has field "error"

  Scenario: Update version with invalid JSON returns 400
    Given a component "uv-bad-json" exists in the database
    When I send a PUT request to "/api/components/uv-bad-json/versions/mvp" with body:
      """
      not valid json
      """
    Then the response status is 400
    And the response body has field "error"

  Scenario: Update version with invalid progress value returns 400
    Given a component "uv-bad-prog" exists in the database
    When I send a PUT request to "/api/components/uv-bad-prog/versions/mvp" with body:
      """
      {"content":"Test","progress":150}
      """
    Then the response status is 400
    And the response body has field "error"

  Scenario: Update version with invalid status returns 400
    Given a component "uv-bad-status" exists in the database
    When I send a PUT request to "/api/components/uv-bad-status/versions/mvp" with body:
      """
      {"content":"Test","status":"invalid"}
      """
    Then the response status is 400
    And the response body has field "error"

  Scenario: Update version with empty body returns 400
    Given a component "uv-empty" exists in the database
    When I send a PUT request to "/api/components/uv-empty/versions/mvp" with body:
      """
      {}
      """
    Then the response status is 400
    And the response body has field "error"
