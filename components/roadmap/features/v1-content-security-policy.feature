@v1
Feature: Content Security Policy Headers
  As the API operator
  I want the server to send CSP, Referrer-Policy, and Permissions-Policy headers
  So that browsers enforce content restrictions and reduce information leakage

  Rule: All API responses must include content security headers

    Scenario: Response includes Content-Security-Policy header
      Given an API server is running with security headers
      When I send a GET request to the "/api/health" endpoint
      Then the response contains header "Content-Security-Policy"
      And the "Content-Security-Policy" header value contains "default-src"

    Scenario: Response includes Referrer-Policy header
      Given an API server is running with security headers
      When I send a GET request to the "/api/health" endpoint
      Then the response contains header "Referrer-Policy"
      And the "Referrer-Policy" header value is "no-referrer"

    Scenario: Response includes Permissions-Policy header
      Given an API server is running with security headers
      When I send a GET request to the "/api/health" endpoint
      Then the response contains header "Permissions-Policy"
