@v1
Feature: API Request Logging
  As the roadmap application
  I want API requests logged for audit and debugging
  So that I can trace requests and diagnose issues

  Rule: API requests are logged for audit and debugging

    Scenario: Successful request is logged
      Given the API server is running with request logging enabled
      And a valid API key "rmap_log" with scope "read"
      When I send a GET request to "/api/components" with that key
      Then the request log contains an entry with:
        | field      | value                |
        | method     | GET                  |
        | path       | /api/components      |
        | status     | 200                  |
        | key_name   | log-key-name         |
        | duration   | (positive integer)   |
        | request_id | (UUID)               |

    Scenario: Failed authentication is logged
      Given the API server is running with request logging enabled
      When I send a GET request with an invalid API key
      Then the request log contains an entry with status 401
      And the log entry does not contain the attempted key value

    Scenario: Rate-limited request is logged
      Given the API server is running with request logging enabled
      When a request is rejected due to rate limiting
      Then the request log contains an entry with status 429
      And the log entry includes the key name

    Scenario: Request body is not logged for security
      Given the API server is running with request logging enabled
      When I send a POST request with a JSON body
      Then the request log does not contain the request body
      And the request log does not contain any API key values

    Scenario: Logs include correlation ID for tracing
      Given the API server is running
      When I send a request with header "X-Request-Id: custom-trace-123"
      Then the response has header "X-Request-Id" with value "custom-trace-123"
      And the request log entry has request_id "custom-trace-123"
