@v1
Feature: API Error Response Format
  As the roadmap application
  I want error responses to follow a consistent format with machine-readable codes
  So that API clients can programmatically handle errors

  Rule: Error responses follow a consistent format

    Scenario: All error responses have a consistent structure
      Given the API server is running
      When any API request results in an error
      Then the response body has this structure:
        """
        {
          "error": "<human-readable message>",
          "code": "<MACHINE_READABLE_CODE>",
          "request_id": "<uuid>"
        }
        """

    Scenario: Error codes map to HTTP status codes
      Then the following error codes exist:
        | code                  | status | description               |
        | AUTHENTICATION_REQUIRED | 401  | No API key provided       |
        | INVALID_API_KEY       | 401    | Key not found or invalid  |
        | API_KEY_EXPIRED       | 401    | Key past expiry date      |
        | API_KEY_REVOKED       | 401    | Key manually revoked      |
        | INSUFFICIENT_SCOPE    | 403    | Key lacks required scope  |
        | RATE_LIMIT_EXCEEDED   | 429    | Too many requests         |
        | VALIDATION_ERROR      | 400    | Invalid input data        |
        | NOT_FOUND             | 404    | Resource not found        |
        | CONFLICT              | 409    | Duplicate resource        |
        | BODY_TOO_LARGE        | 413    | Request body exceeds limit|
        | INTERNAL_ERROR        | 500    | Unexpected server error   |

    Scenario: Internal errors do not leak implementation details
      Given the API server is running
      When an unexpected error occurs during request handling
      Then the response status is 500
      And the response body error message is "Internal server error"
      And the response does not contain stack traces
      And the response does not contain file paths
      And the full error is logged server-side with the request_id
