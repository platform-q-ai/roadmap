@v1
Feature: API Input Validation (v1)
  As the roadmap application
  I want all API inputs validated and sanitised
  So that the system is protected from injection and malformed data

  Rule: All API inputs are validated and sanitised

    Scenario: Reject request body exceeding maximum size
      Given the API server is running with max body size of 1MB
      And a valid API key with scope "write"
      When I send a POST request with a body larger than 1MB
      Then the response status is 413
      And the response body has field "error" with value "Request body too large"

    Scenario: Reject malformed JSON body
      Given the API server is running with authentication enabled
      And a valid API key with scope "write"
      When I send a POST request to "/api/components" with body "not json"
      Then the response status is 400
      And the response body has field "error" with value "Invalid JSON body"

    Scenario: Reject request with path traversal attempt
      Given the API server is running with authentication enabled
      And a valid API key with scope "read"
      When I send a GET request to "/api/components/../../../etc/passwd" with that key
      Then the response status is 404
      And the response body has field "error"

    Scenario: Strip HTML from string inputs
      Given the API server is running with authentication enabled
      And a valid API key with scope "write"
      When I send a POST request with name "<script>alert(1)</script>"
      Then the stored name does not contain HTML tags
      And script content is stripped

    Scenario: Validate component ID format
      Given the API server is running with authentication enabled
      And a valid API key with scope "write"
      When I send a POST request with id "invalid id with spaces!"
      Then the response status is 400
      And the response body has field "error" containing "invalid"

    Scenario: Component ID must be kebab-case
      Given the API server is running with authentication enabled
      And a valid API key with scope "write"
      When I send an authenticated POST request to "/api/components" with body:
        """
        {"id":"valid-kebab-case","name":"Valid","type":"component","layer":"supervisor-layer"}
        """
      Then the response status is 201
