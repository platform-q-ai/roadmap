@v1
Feature: API Key Authentication
  As the roadmap application
  I want all API endpoints except health to require a valid API key
  So that unauthenticated clients cannot access or modify roadmap data

  Rule: All API endpoints except health require a valid API key

    Scenario: Health endpoint does not require authentication
      Given the API server is running
      When I send a GET request to "/api/health" without an API key
      Then the response status is 200
      And the response body has field "status" with value "ok"

    Scenario: Authenticated request with valid key succeeds
      Given the API server is running
      And a valid API key "rmap_abc123" with scope "read" exists
      When I send a GET request to "/api/components" with header "Authorization: Bearer rmap_abc123"
      Then the response status is 200

    Scenario: Request without API key returns 401
      Given the API server is running
      When I send a GET request to "/api/components" without an API key
      Then the response status is 401
      And the response body has field "error" with value "Authentication required"
      And the response has header "WWW-Authenticate" with value "Bearer"

    Scenario: Request with invalid API key returns 401
      Given the API server is running
      When I send a GET request to "/api/components" with header "Authorization: Bearer rmap_invalid"
      Then the response status is 401
      And the response body has field "error" with value "Invalid API key"

    Scenario: Request with expired API key returns 401
      Given the API server is running
      And an expired API key "rmap_expired" exists
      When I send a GET request to "/api/components" with header "Authorization: Bearer rmap_expired"
      Then the response status is 401
      And the response body has field "error" with value "API key expired"

    Scenario: Request with revoked API key returns 401
      Given the API server is running
      And a revoked API key "rmap_revoked" exists
      When I send a GET request to "/api/components" with header "Authorization: Bearer rmap_revoked"
      Then the response status is 401
      And the response body has field "error" with value "API key revoked"

    Scenario: API key is accepted via X-API-Key header as alternative
      Given the API server is running
      And a valid API key "rmap_alt123" with scope "read" exists
      When I send a GET request to "/api/components" with header "X-API-Key: rmap_alt123"
      Then the response status is 200

    Scenario: Last-used timestamp is updated on successful authentication
      Given the API server is running
      And a valid API key "rmap_track" with scope "read" exists
      When I send a GET request to "/api/components" with that key
      Then the key's last_used_at timestamp is updated to the current time
