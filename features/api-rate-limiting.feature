@v1
Feature: API Rate Limiting
  As the roadmap application
  I want API requests to be rate-limited per key and per endpoint
  So that the system is protected from abuse and accidental overload

  Rule: API requests are rate-limited per key and per endpoint

    Scenario: Default rate limit is applied per API key
      Given the API server is running with default rate limit of 100 requests per minute
      And a valid API key "rmap_rate" with scope "read"
      When I send 100 GET requests to "/api/components" within 1 minute
      Then all 100 requests return status 200

    Scenario: Exceeding rate limit returns 429
      Given the API server is running with default rate limit of 100 requests per minute
      And a valid API key "rmap_over" with scope "read"
      When I send 101 GET requests to "/api/components" within 1 minute
      Then the 101st request returns status 429
      And the response body has field "error" with value "Rate limit exceeded"
      And the response has header "Retry-After" with a positive integer value

    Scenario: Rate limit headers are included in every response
      Given the API server is running
      And a valid API key "rmap_headers" with scope "read"
      When I send a GET request to "/api/components" with that key
      Then the response has header "X-RateLimit-Limit"
      And the response has header "X-RateLimit-Remaining"
      And the response has header "X-RateLimit-Reset"

    Scenario: Rate limits reset after the window expires
      Given the API server is running with rate limit of 10 requests per minute
      And a valid API key "rmap_reset" with scope "read"
      And the key has exhausted its rate limit
      When 60 seconds have elapsed
      And I send a GET request to "/api/components" with that key
      Then the response status is 200
      And X-RateLimit-Remaining reflects the fresh window

    Scenario: Write operations have a stricter rate limit
      Given the API server is running
      And write endpoints have a rate limit of 30 requests per minute
      And a valid API key with scopes "read" and "write"
      When I send 31 POST requests to "/api/components" within 1 minute
      Then the 31st request returns status 429

    Scenario: Different keys have independent rate limits
      Given the API server is running with rate limit of 10 requests per minute
      And valid API keys "rmap_key1" and "rmap_key2" exist
      When "rmap_key1" sends 10 requests (exhausting its limit)
      And "rmap_key2" sends 1 request
      Then "rmap_key2" gets status 200
      And "rmap_key1" gets status 429 on its next request

    Scenario: Rate limit can be configured per key
      Given the API server is running
      And API key "rmap_premium" has a custom rate limit of 500 requests per minute
      When "rmap_premium" sends 200 requests within 1 minute
      Then all requests return status 200
      And X-RateLimit-Limit reflects 500

    Scenario: Health endpoint is exempt from rate limiting
      Given the API server is running
      When I send 1000 GET requests to "/api/health" within 1 minute
      Then all requests return status 200

    Scenario: Rate limit state is stored in memory (not database)
      Given the API server is running
      When the server processes rate-limited requests
      Then no rate limit data is written to the database
      And rate limit counters reset on server restart
