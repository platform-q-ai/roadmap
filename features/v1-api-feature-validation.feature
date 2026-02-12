Feature: API Feature File Validation
  As an LLM engineer working autonomously
  I want uploaded feature files validated for Gherkin syntax
  So that only well-formed specifications are stored in the system

  Rule: Uploaded feature files are validated for Gherkin syntax

    Scenario: Valid Gherkin is accepted
      Given the API server is running
      And a component "valid-gherkin" exists
      When I send a PUT request to "/api/components/valid-gherkin/versions/v1/features/valid.feature" with Gherkin content
      Then the response status is 200

    Scenario: Feature file without Feature: keyword is rejected
      Given the API server is running
      And a component "bad-gherkin" exists
      When I send a PUT request to "/api/components/bad-gherkin/versions/v1/features/bad.feature" with body:
        """
        This is not a valid feature file.
        It has no Feature: keyword.
        """
      Then the response status is 400
      And the response body has field "error" containing "Feature"

    Scenario: Feature file without any scenarios is rejected
      Given the API server is running
      And a component "no-scenario" exists
      When I send a PUT request to "/api/components/no-scenario/versions/v1/features/empty.feature" with body:
        """
        Feature: Empty Feature
          This feature has a description but no scenarios.
        """
      Then the response status is 400
      And the response body has field "error" containing "scenario"

    Scenario: Feature file with empty body is rejected
      Given the API server is running
      And a component "empty-body" exists
      When I send a PUT request to "/api/components/empty-body/versions/v1/features/empty.feature" with empty body
      Then the response status is 400
      And the response body has field "error" containing "empty"

    Scenario: Feature file with scenarios but no steps is rejected
      Given the API server is running
      And a component "no-steps" exists
      When I send a PUT request to "/api/components/no-steps/versions/v1/features/stepless.feature" with body:
        """
        Feature: Stepless Feature
          Scenario: Empty scenario
        """
      Then the response status is 400
      And the response body has field "error" containing "steps"

    Scenario: Feature filename must end with .feature
      Given the API server is running
      And a component "bad-ext" exists
      When I send a PUT request to "/api/components/bad-ext/versions/v1/features/test.txt" with Gherkin content
      Then the response status is 400
      And the response body has field "error" containing ".feature"

    Scenario: Feature filename must be kebab-case
      Given the API server is running
      And a component "bad-name" exists
      When I send a PUT request to "/api/components/bad-name/versions/v1/features/under_score.feature" with Gherkin content
      Then the response status is 400
      And the response body has field "error" containing "filename"

    Scenario: Validation response includes line number for parse errors
      Given the API server is running
      And a component "parse-err" exists
      When I send a PUT request to "/api/components/parse-err/versions/v1/features/broken.feature" with Gherkin containing a syntax error at line 5
      Then the response status is 400
      And the response body has field "error" containing line number information
