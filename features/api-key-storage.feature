@v1
Feature: API Key Storage
  As the roadmap application
  I want API keys stored securely as salted hashes
  So that compromised database access does not expose raw keys

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
