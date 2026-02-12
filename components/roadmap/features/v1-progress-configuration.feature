@wip @v1
Feature: Progress Configuration
  As the roadmap application
  I want configurable progress blend weights per component
  So that different components can weight semver vs step coverage differently

  Rule: Progress blend weights are configurable per component

    Scenario: Set custom weights
      Given the API server is running
      And a valid API key with scope "write"
      And component "custom-w" exists
      When I send a PUT request to "/api/components/custom-w/progress-config" with body:
        """
        {"semver_weight": 0.2, "step_weight": 0.8}
        """
      Then the response status is 200
      And the response body has field "semver_weight" with value "0.2"
      And the response body has field "step_weight" with value "0.8"

    Scenario: Weights must sum to 1.0
      Given the API server is running
      And a valid API key with scope "write"
      When I send a PUT request to "/api/components/bad-w/progress-config" with body:
        """
        {"semver_weight": 0.5, "step_weight": 0.6}
        """
      Then the response status is 400
      And the response body has field "error" containing "sum to 1.0"

    Scenario: Weights must be between 0 and 1
      Given the API server is running
      And a valid API key with scope "write"
      When I send a PUT request with a negative weight
      Then the response status is 400
      And the response body has field "error" containing "between 0 and 1"

    Scenario: Get current weights for a component
      Given the API server is running
      And a valid API key with scope "read"
      And component "config-comp" has custom weights
      When I send a GET request to "/api/components/config-comp/progress-config"
      Then the response status is 200
      And the response body has field "semver_weight"
      And the response body has field "step_weight"

    Scenario: Default weights returned when no custom config
      Given the API server is running
      And a valid API key with scope "read"
      And component "default-c" has no custom weights
      When I send a GET request to "/api/components/default-c/progress-config"
      Then the response status is 200
      And the response body has field "semver_weight" with value "0.5"
      And the response body has field "step_weight" with value "0.5"
