@v1
Feature: Secure and Rate-Limited API
  As the roadmap application
  I want the REST API to be secured with API key authentication and rate limiting
  So that only authorised LLM engineers can manage roadmap content headlessly
  and the system is protected from abuse, brute-force attacks, and accidental overload

  The MVP API has no authentication. V1 adds API key authentication with scoped
  permissions, per-key rate limiting, request logging, and security headers.
  API keys are stored as salted hashes. All sensitive operations require
  appropriate scopes. Rate limits are configurable per key and per endpoint.

  # ── API Key Generation ──────────────────────────────────────────────

  Rule: API keys are generated securely and stored as hashed values

    Scenario: Generate a new API key via CLI
      Given the API key management CLI
      When I run the command to generate a new key with name "ci-bot"
      Then a new API key is returned in the format "rmap_<32 hex characters>"
      And the key is displayed once and never stored in plaintext
      And a salted SHA-256 hash of the key is stored in the database

    Scenario: Generate a key with specific scopes
      Given the API key management CLI
      When I run the command to generate a key with name "reader" and scopes "read"
      Then the key is created with scope "read"
      And the key cannot be used for write operations

    Scenario: Generate a key with multiple scopes
      Given the API key management CLI
      When I run the command to generate a key with name "engineer" and scopes "read,write"
      Then the key is created with scopes "read" and "write"

    Scenario: Generate a key with admin scope
      Given the API key management CLI
      When I run the command to generate a key with name "admin-bot" and scopes "read,write,admin"
      Then the key is created with scopes "read", "write", and "admin"

    Scenario: API key name must be unique
      Given a key with name "existing-bot" already exists
      When I run the command to generate a key with name "existing-bot"
      Then an error is returned with message "Key name already exists: existing-bot"
      And no new key is created

    Scenario: API key has an optional expiry date
      Given the API key management CLI
      When I run the command to generate a key with name "temp-key" and expiry "2026-12-31"
      Then the key is created with expiry date "2026-12-31T00:00:00Z"

    Scenario: API key with no expiry never expires
      Given the API key management CLI
      When I run the command to generate a key with name "permanent-key" and no expiry
      Then the key is created with a null expiry date

  # ── API Key Storage ─────────────────────────────────────────────────

  Rule: API keys are stored securely in the database

    Scenario: Key record contains required fields
      Given a newly generated API key
      Then the database record contains:
        | field        | type     | description                    |
        | id           | integer  | Auto-incrementing primary key  |
        | name         | text     | Unique human-readable name     |
        | key_hash     | text     | Salted SHA-256 hash            |
        | salt         | text     | Unique per-key salt            |
        | scopes       | text     | JSON array of scope strings    |
        | created_at   | text     | ISO 8601 timestamp             |
        | expires_at   | text     | ISO 8601 timestamp or null     |
        | last_used_at | text     | ISO 8601 timestamp or null     |
        | is_active    | integer  | 1 = active, 0 = revoked        |

    Scenario: Raw API key cannot be retrieved from the database
      Given a key "stored-key" exists in the database
      When I query the api_keys table for "stored-key"
      Then the result contains key_hash but not the raw key
      And the key_hash cannot be reversed to obtain the raw key

    Scenario: Key verification uses constant-time comparison
      Given a key "verify-key" exists in the database
      When I verify an API key against the stored hash
      Then the comparison uses a timing-safe equality check
      And the verification completes in constant time regardless of match

  # ── API Key Authentication ──────────────────────────────────────────

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

  # ── Scope-Based Authorisation ───────────────────────────────────────

  Rule: API operations require specific scopes

    Scenario: Read scope allows GET requests
      Given a valid API key with scope "read"
      When I send a GET request to "/api/components" with that key
      Then the response status is 200

    Scenario: Read scope denies POST requests
      Given a valid API key with scope "read" only
      When I send a POST request to "/api/components" with that key and body:
        """
        {"id":"new","name":"New","type":"component","layer":"supervisor-layer"}
        """
      Then the response status is 403
      And the response body has field "error" with value "Insufficient scope: write required"

    Scenario: Write scope allows POST requests
      Given a valid API key with scopes "read" and "write"
      When I send a POST request to "/api/components" with that key and body:
        """
        {"id":"writable","name":"Writable","type":"component","layer":"supervisor-layer"}
        """
      Then the response status is 201

    Scenario: Write scope allows PUT requests
      Given a valid API key with scopes "read" and "write"
      When I send a PUT request to "/api/components/test-comp/features/v1-test.feature" with that key
      Then the response status is not 403

    Scenario: Write scope allows PUT requests
      Given a valid API key with scopes "read" and "write"
      When I send a PUT request to "/api/components/test-comp/versions/mvp" with that key
      Then the response status is not 403

    Scenario: Write scope allows DELETE requests for component data
      Given a valid API key with scopes "read" and "write"
      When I send a DELETE request to "/api/components/del-comp" with that key
      Then the response status is not 403

    Scenario: Admin scope required for key management endpoints
      Given a valid API key with scopes "read" and "write" but not "admin"
      When I send a POST request to "/api/admin/keys" with that key
      Then the response status is 403
      And the response body has field "error" with value "Insufficient scope: admin required"

    Scenario: Admin scope allows key management
      Given a valid API key with scope "admin"
      When I send a GET request to "/api/admin/keys" with that key
      Then the response status is 200

    Scenario: Scope mapping for all HTTP methods
      Then the following scope mapping applies:
        | method  | scope  |
        | GET     | read   |
        | POST    | write  |
        | PUT     | write  |
        | PATCH   | write  |
        | DELETE  | write  |

  # ── API Key Management Endpoints ────────────────────────────────────

  Rule: Admin users can manage API keys via the API

    Scenario: List all API keys (admin)
      Given the API server is running
      And a valid API key with scope "admin"
      And 3 API keys exist in the database
      When I send a GET request to "/api/admin/keys" with the admin key
      Then the response status is 200
      And the response body is an array of 3 key records
      And no record contains the raw key or key_hash

    Scenario: Revoke an API key (admin)
      Given the API server is running
      And a valid API key with scope "admin"
      And a key with name "revoke-me" exists and is active
      When I send a DELETE request to "/api/admin/keys/revoke-me" with the admin key
      Then the response status is 200
      And the key "revoke-me" is marked as inactive
      And subsequent requests with that key return 401

    Scenario: Generate a new key via API (admin)
      Given the API server is running
      And a valid API key with scope "admin"
      When I send a POST request to "/api/admin/keys" with the admin key and body:
        """
        {"name":"api-created","scopes":["read","write"]}
        """
      Then the response status is 201
      And the response body contains the raw key (displayed once)
      And the response body has field "name" with value "api-created"

    Scenario: Revoke nonexistent key returns 404
      Given the API server is running
      And a valid API key with scope "admin"
      When I send a DELETE request to "/api/admin/keys/ghost-key" with the admin key
      Then the response status is 404
      And the response body has field "error"

  # ── Rate Limiting ───────────────────────────────────────────────────

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

  # ── Security Headers ────────────────────────────────────────────────

  Rule: API responses include security headers

    Scenario: All responses include standard security headers
      Given the API server is running
      When I send any request to the API
      Then the response has header "X-Content-Type-Options" with value "nosniff"
      And the response has header "X-Frame-Options" with value "DENY"
      And the response has header "Strict-Transport-Security" with value "max-age=31536000; includeSubDomains"
      And the response has header "Cache-Control" with value "no-store"
      And the response has header "X-Request-Id" with a UUID value

    Scenario: CORS is restricted to configured origins
      Given the environment variable "ALLOWED_ORIGINS" is set to "https://app.example.com"
      When I send an OPTIONS request with "Origin: https://app.example.com"
      Then the response has header "Access-Control-Allow-Origin" with value "https://app.example.com"

    Scenario: CORS rejects unconfigured origins
      Given the environment variable "ALLOWED_ORIGINS" is set to "https://app.example.com"
      When I send an OPTIONS request with "Origin: https://evil.example.com"
      Then the response does not have header "Access-Control-Allow-Origin"

    Scenario: CORS allows all origins when not configured (development)
      Given the environment variable "ALLOWED_ORIGINS" is not set
      When I send an OPTIONS request with "Origin: http://localhost:3000"
      Then the response has header "Access-Control-Allow-Origin" with value "*"

  # ── Request Logging ─────────────────────────────────────────────────

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

  # ── Input Validation ────────────────────────────────────────────────

  Rule: All API inputs are validated and sanitised

    Scenario: Reject request body exceeding maximum size
      Given the API server is running with max body size of 1MB
      When I send a POST request with a body larger than 1MB
      Then the response status is 413
      And the response body has field "error" with value "Request body too large"

    Scenario: Reject malformed JSON body
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body "not json"
      Then the response status is 400
      And the response body has field "error" with value "Invalid JSON body"

    Scenario: Reject request with path traversal attempt
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/components/../../../etc/passwd"
      Then the response status is 400
      And the response body has field "error"

    Scenario: Strip HTML from string inputs
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request with name "<script>alert(1)</script>"
      Then the stored name does not contain HTML tags
      And script content is stripped

    Scenario: Validate component ID format
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request with id "invalid id with spaces!"
      Then the response status is 400
      And the response body has field "error" containing "invalid"

    Scenario: Component ID must be kebab-case
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body:
        """
        {"id":"valid-kebab-case","name":"Valid","type":"component","layer":"supervisor-layer"}
        """
      Then the response status is 201

  # ── Error Response Format ───────────────────────────────────────────

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
