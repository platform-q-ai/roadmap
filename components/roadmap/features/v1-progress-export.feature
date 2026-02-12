@wip @v1
Feature: Step-Based Progress in Architecture Export
  As the roadmap application
  I want step-based progress included in architecture export and JSON output
  So that the web view and consumers can display step-level progress bars

  Rule: Step-based progress is included in architecture export

    Scenario: Architecture export includes step-based progress per version
      Given the API server is running
      And a valid API key with scope "read"
      And components have version-tagged features with test results
      When I send a GET request to "/api/architecture"
      Then each enriched node includes per-version progress with:
        | field                       | description                     |
        | versions.mvp.progress       | Combined progress for MVP       |
        | versions.mvp.total_steps    | Total steps for MVP features    |
        | versions.mvp.passing_steps  | Passing steps for MVP           |
        | versions.v1.progress        | Combined progress for V1        |
        | versions.v1.total_steps     | Total steps for V1 features     |
        | versions.v1.passing_steps   | Passing steps for V1            |

    Scenario: JSON export includes step-based progress
      Given the export use case runs
      Then the output data.json includes per-version step counts
      And the web view can display step-level progress bars
