@v1
Feature: API Key Generation
  As the roadmap application
  I want to generate API keys securely with salted hashes
  So that only authorised clients can access the API

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
