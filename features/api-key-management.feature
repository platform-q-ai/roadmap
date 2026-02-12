@v1
Feature: API Key Management Endpoints
  As the roadmap application
  I want admin users to manage API keys via the REST API
  So that keys can be created and revoked without CLI access

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
