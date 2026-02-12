@wip @v1
Feature: API Version-Scoped Feature Retrieval
  As an LLM engineer working autonomously
  I want to retrieve feature files scoped to their explicit version
  So that I can inspect and verify specifications per version tier

  Rule: Feature files are retrieved scoped to their explicit version

    Scenario: List all features for a component across all versions
      Given the API server is running
      And a valid API key with scope "read"
      And component "feat-list" has 2 features under "mvp", 2 under "v1", 1 under "v2"
      When I send a GET request to "/api/components/feat-list/features"
      Then the response status is 200
      And the response body is an array of 5 feature objects
      And each object has fields: filename, version, title, content, step_count, updated_at

    Scenario: List features for a specific version
      Given the API server is running
      And a valid API key with scope "read"
      And component "feat-ver" has 3 "mvp" features and 4 "v1" features
      When I send a GET request to "/api/components/feat-ver/versions/v1/features"
      Then the response status is 200
      And the response body is an array of 4 features
      And every feature has version "v1"

    Scenario: Get a single feature by version and filename
      Given the API server is running
      And a valid API key with scope "read"
      And component "feat-single" has feature "auth.feature" under version "v1"
      When I send a GET request to "/api/components/feat-single/versions/v1/features/auth.feature"
      Then the response status is 200
      And the response body has field "filename" with value "auth.feature"
      And the response body has field "version" with value "v1"
      And the response body has field "content" containing the full Gherkin text
      And the response body has field "step_count"

    Scenario: Get feature from wrong version returns 404
      Given the API server is running
      And a valid API key with scope "read"
      And component "ver-miss" has feature "auth.feature" under version "mvp" only
      When I send a GET request to "/api/components/ver-miss/versions/v1/features/auth.feature"
      Then the response status is 404
      And the response body has field "error" containing "not found"

    Scenario: Get nonexistent feature returns 404
      Given the API server is running
      And a valid API key with scope "read"
      And component "feat-missing" exists
      When I send a GET request to "/api/components/feat-missing/versions/v1/features/ghost.feature"
      Then the response status is 404

    Scenario: Get features for nonexistent component returns 404
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/components/nonexistent/versions/v1/features"
      Then the response status is 404

    Scenario: Get raw feature content as plain text
      Given the API server is running
      And a valid API key with scope "read"
      And component "raw-feat" has feature "raw.feature" under version "v1"
      When I send a GET request to "/api/components/raw-feat/versions/v1/features/raw.feature" with header "Accept: text/plain"
      Then the response status is 200
      And the response content type is "text/plain"
      And the response body is the raw Gherkin text

    Scenario: Feature listing includes step counts for progress maths
      Given the API server is running
      And a valid API key with scope "read"
      And component "step-list" has 3 features under version "v1"
      When I send a GET request to "/api/components/step-list/versions/v1/features"
      Then each feature object has field "step_count" as a positive integer
      And each feature object has field "scenario_count" as a positive integer
      And the response includes a "totals" field with:
        | field               | description                         |
        | total_features      | Number of features in this version  |
        | total_scenarios     | Sum of scenarios across features    |
        | total_steps         | Sum of all steps across features    |
        | total_given_steps   | Sum of Given/And steps              |
        | total_when_steps    | Sum of When steps                   |
        | total_then_steps    | Sum of Then/But steps               |
