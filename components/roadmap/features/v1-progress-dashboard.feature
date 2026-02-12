@wip @v1
Feature: Progress Dashboard Data
  As the roadmap application
  I want aggregated step-based progress data via the API
  So that dashboards and reports can show per-version completion summaries

  Rule: The API provides aggregated step-based progress data

    Scenario: Get progress summary for all components at a version
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/progress/summary?version=mvp"
      Then the response status is 200
      And the response body has field "version" with value "mvp"
      And the response body has field "total_components" as a positive integer
      And the response body has field "average_progress" as a number 0-100
      And the response body has field "complete_count" as an integer
      And the response body has field "in_progress_count" as an integer
      And the response body has field "planned_count" as an integer
      And the response body has field "aggregate_steps" with:
        | field          | description                          |
        | total_steps    | Sum of all steps across all features |
        | passing_steps  | Sum of all passing steps             |
        | step_coverage  | Overall passing/total percentage     |

    Scenario: Per-component summary includes step-level detail
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/progress/summary?version=mvp"
      Then each component in the summary has:
        | field              | description                         |
        | id                 | Component ID                        |
        | name               | Component name                      |
        | semver_progress    | Progress from current_version       |
        | total_steps        | Total Given/When/Then steps         |
        | passing_steps      | Steps in passing scenarios          |
        | step_progress      | passing_steps / total_steps * 100   |
        | combined_progress  | Weighted blend of semver + steps    |
        | status             | Derived from combined progress      |
        | feature_count      | Number of feature files             |
        | scenario_count     | Total scenarios across features     |

    Scenario: Progress summary across all versions
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/progress/overview"
      Then the response status is 200
      And the response body has summaries for versions "mvp", "v1", and "v2"
      And each version summary includes:
        | field              | description                      |
        | version            | Version tag                      |
        | total_components   | Number of components             |
        | total_steps        | Sum of steps across all features |
        | passing_steps      | Sum of passing steps             |
        | step_coverage      | Overall percentage               |
        | complete_count     | Components at 100%               |
        | in_progress_count  | Components at 1-99%              |
        | planned_count      | Components at 0%                 |

    Scenario: Get progress history for a component version
      Given the API server is running
      And a valid API key with scope "read"
      And component "history" has had multiple test runs over time
      When I send a GET request to "/api/components/history/versions/mvp/progress-history"
      Then the response status is 200
      And the response body is an array of progress snapshots
      And each snapshot has fields:
        | field              | description                    |
        | timestamp          | When the test run occurred     |
        | total_steps        | Total steps at that time       |
        | passing_steps      | Passing steps at that time     |
        | step_progress      | Step-based percentage          |
        | semver_progress    | Semver-based percentage        |
        | combined_progress  | Weighted blend                 |

    Scenario: Progress API provides CSV export
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/progress/summary?version=mvp&format=csv"
      Then the response status is 200
      And the response content type is "text/csv"
      And the CSV has columns: id, name, total_steps, passing_steps, step_progress, semver_progress, combined_progress, status
