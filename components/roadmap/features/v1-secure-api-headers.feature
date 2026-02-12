Feature: Secure API — Security Headers and Input Validation
  As the roadmap application
  I want the REST API to include security headers, validate inputs, and return structured errors
  So that the API is hardened against common attacks and provides consistent error responses

  Background:
    Given the API server is running

  # ── Security Headers ────────────────────────────────────────────────

  Scenario: All responses include X-Content-Type-Options header
    When I send a GET request to "/api/health"
    Then the response status is 200
    And the response has header "X-Content-Type-Options" with value "nosniff"

  Scenario: All responses include X-Frame-Options header
    When I send a GET request to "/api/health"
    Then the response status is 200
    And the response has header "X-Frame-Options" with value "DENY"

  Scenario: All responses include X-Request-Id header
    When I send a GET request to "/api/health"
    Then the response status is 200
    And the response has header "X-Request-Id"

  Scenario: Error responses also include security headers
    When I send a GET request to "/api/components/nonexistent-sec"
    Then the response status is 404
    And the response has header "X-Content-Type-Options" with value "nosniff"
    And the response has header "X-Frame-Options" with value "DENY"
    And the response has header "X-Request-Id"

  # ── Structured Error Responses ──────────────────────────────────────

  Scenario: Error responses include request_id field
    When I send a GET request to "/api/components/ghost-err"
    Then the response status is 404
    And the response body has field "error"
    And the response body has field "request_id"

  Scenario: Validation error includes error field
    When I send a POST request to "/api/components" with body:
      """
      {"id":"x"}
      """
    Then the response status is 400
    And the response body has field "error"
    And the response body has field "request_id"

  # ── Input Validation ────────────────────────────────────────────────

  Scenario: Reject request body exceeding maximum size
    Given a component "iv-big" exists in the database
    When I send a PUT request to "/api/components/iv-big/versions/mvp" with a body larger than 1MB
    Then the response status is 413
    And the response body has field "error"

  Scenario: Reject malformed JSON body on POST
    When I send a POST request to "/api/components" with body:
      """
      not json at all
      """
    Then the response status is 400
    And the response body has field "error"

  Scenario: Component ID must be kebab-case
    When I send a POST request to "/api/components" with body:
      """
      {"id":"Invalid ID!","name":"Bad","type":"component","layer":"supervisor-layer"}
      """
    Then the response status is 400
    And the response body has field "error"
