Feature: Admin Route Body Size Limit
  As an API operator
  I want admin routes to reject oversized request bodies
  So that the server is protected from denial-of-service via large payloads

  # ── Body size enforcement ──────────────────────────────────

  Scenario: Admin route accepts a request body within the limit
    Given an admin request with a body of 500 bytes
    When the admin route processes the request
    Then the request body is read successfully

  Scenario: Admin route rejects a request body exceeding 1 MB
    Given an admin request with a body of 1048577 bytes
    When the admin route processes the request
    Then the request is rejected with a 413 status code
    And the error message mentions the body size limit
