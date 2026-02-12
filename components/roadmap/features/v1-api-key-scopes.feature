@v1
Feature: API Scope-Based Authorization
  As the roadmap application
  I want API operations to require specific scopes
  So that read-only clients cannot make destructive changes

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

    Scenario: Write scope allows PUT requests for features
      Given a valid API key with scopes "read" and "write"
      When I send a PUT request to "/api/components/test-comp/features/v1-test.feature" with that key
      Then the response status is not 403

    Scenario: Write scope allows PUT requests for versions
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
