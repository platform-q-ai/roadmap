@wip @v1
Feature: Recording Step-Level Test Results
  As the roadmap application
  I want to record per-scenario pass/fail results with step counts
  So that step-based progress is updated from actual test execution

  Rule: Test results record per-scenario pass/fail and step counts

    Scenario: Record test results with step counts
      Given the API server is running
      And a valid API key with scope "write"
      And component "results-comp" has features under version "mvp" with 15 total steps
      When I send a POST request to "/api/components/results-comp/versions/mvp/test-results" with body:
        """
        {
          "results": [
            {
              "scenario": "Create a node",
              "feature": "crud.feature",
              "status": "passed",
              "steps": 5,
              "duration_ms": 120
            },
            {
              "scenario": "Delete a node",
              "feature": "crud.feature",
              "status": "passed",
              "steps": 4,
              "duration_ms": 85
            },
            {
              "scenario": "Handle invalid input",
              "feature": "validation.feature",
              "status": "failed",
              "steps": 6,
              "duration_ms": 200,
              "error": "Expected 400, got 500"
            }
          ]
        }
        """
      Then the response status is 200
      And the response body has field "recorded" with value 3
      And the response body has field "total_steps" with value 15
      And the response body has field "passing_steps" with value 9
      And the response body has field "failing_steps" with value 6
      And the response body has field "progress_percent" with value 60

    Scenario: Test results automatically update step-based progress
      Given component "auto-prog" has 20 total steps under version "v1"
      And current progress for "auto-prog" version "v1" is 0 percent
      When I record test results with 15 passing steps
      Then the progress for "auto-prog" version "v1" updates to 75 percent
      And the status updates to "in-progress"

    Scenario: New test results overwrite previous results
      Given component "overwrite" has previous test results showing 50% progress
      When I submit new test results showing 80% progress
      Then the stored results reflect the new submission
      And the progress is recalculated to 80 percent

    Scenario: Query test results for a component version
      Given the API server is running
      And a valid API key with scope "read"
      And component "query-comp" has recorded test results for version "v1"
      When I send a GET request to "/api/components/query-comp/versions/v1/test-results"
      Then the response status is 200
      And the response body has field "version" with value "v1"
      And the response body has field "total_steps" as a positive integer
      And the response body has field "passing_steps" as an integer
      And the response body has field "failing_steps" as an integer
      And the response body has field "progress_percent" as a number 0-100
      And the response body has field "last_run" as an ISO 8601 timestamp
      And the response body has field "scenarios" as an array of per-scenario results

    Scenario: Per-scenario result includes step count
      Given recorded test results for component "detail-comp" version "mvp"
      When I query the test results
      Then each scenario entry has fields:
        | field       | type     | description                          |
        | scenario    | string   | Scenario name                        |
        | feature     | string   | Feature filename                     |
        | status      | string   | "passed" or "failed"                 |
        | steps       | number   | Number of steps in this scenario     |
        | duration_ms | number   | Execution time in milliseconds       |
        | error       | string?  | Error message if failed              |
        | last_run    | string   | ISO 8601 timestamp                   |

    Scenario: Test results can be submitted from CI pipeline (Cucumber JSON)
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components/ci-comp/versions/mvp/test-results/cucumber" with Cucumber JSON output
      Then the results are parsed extracting scenario names, step counts, and pass/fail
      And the step-based progress is recalculated

    Scenario: Test results rejected for nonexistent component
      Given the API server is running
      And a valid API key with scope "write"
      When I send a POST request to "/api/components/ghost/versions/v1/test-results" with results
      Then the response status is 404

    Scenario: Test results rejected for nonexistent version
      Given the API server is running
      And a valid API key with scope "write"
      And component "real-comp" exists but has no features under version "v2"
      When I send a POST request to "/api/components/real-comp/versions/v2/test-results" with results
      Then the response status is 400
      And the response body has field "error" containing "no features"
