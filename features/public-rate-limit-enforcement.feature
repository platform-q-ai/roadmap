@v1
Feature: Public Rate Limit Enforcement
  As the roadmap API operator
  I want public endpoints to be rejected when their rate limit is exceeded
  So that the system is protected from abuse on unauthenticated paths

  Rule: Public endpoints must enforce rate limits, not just track them

    Scenario: Public endpoint allows requests within the limit
      Given an API server with a public rate limit of 5 requests per window
      When I send 5 GET requests to the public "/api/architecture" endpoint
      Then all requests return HTTP 200

    Scenario: Public endpoint returns 429 when rate limit is exceeded
      Given an API server with a public rate limit of 3 requests per window
      When I send 4 GET requests to the public "/api/architecture" endpoint
      Then the 4th request returns HTTP 429
      And the response body contains error code "RATE_LIMIT_EXCEEDED"
      And the response includes a "Retry-After" header

    Scenario: Rate limit headers are present on public endpoint responses
      Given an API server with a public rate limit of 10 requests per window
      When I send 1 GET request to the public "/api/architecture" endpoint
      Then the response has "X-RateLimit-Limit" header
      And the response has "X-RateLimit-Remaining" header
      And the response has "X-RateLimit-Reset" header
