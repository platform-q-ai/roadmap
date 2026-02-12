@v1
Feature: API Security Headers and CORS
  As the roadmap application
  I want additional security headers (HSTS, Cache-Control) and configurable CORS
  So that the API is hardened for production deployment

  Rule: API responses include security headers

    Scenario: All responses include standard security headers
      Given the API server is running with authentication enabled
      When I send any request to the API
      Then the response has header "X-Content-Type-Options" with value "nosniff"
      And the response has header "X-Frame-Options" with value "DENY"
      And the response has header "Strict-Transport-Security" with value "max-age=31536000; includeSubDomains"
      And the response has header "Cache-Control" with value "no-store"
      And the response has header "X-Request-Id" with a UUID value

    Scenario: CORS is restricted to configured origins
      Given the environment variable "ALLOWED_ORIGINS" is set to "https://app.example.com"
      And the API server is running with authentication enabled
      When I send an OPTIONS request with "Origin: https://app.example.com"
      Then the response has header "Access-Control-Allow-Origin" with value "https://app.example.com"

    Scenario: CORS rejects unconfigured origins
      Given the environment variable "ALLOWED_ORIGINS" is set to "https://app.example.com"
      And the API server is running with authentication enabled
      When I send an OPTIONS request with "Origin: https://evil.example.com"
      Then the response does not have header "Access-Control-Allow-Origin"

    Scenario: CORS allows all origins when not configured (development)
      Given the environment variable "ALLOWED_ORIGINS" is not set
      And the API server is running with authentication enabled
      When I send an OPTIONS request with "Origin: http://localhost:3000"
      Then the response has header "Access-Control-Allow-Origin" with value "*"
