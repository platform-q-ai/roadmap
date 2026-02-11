@wip @v1
Feature: Feature-Driven Progress Tracking
  As the roadmap application
  I want to read version-tagged feature files (mvp, v1, v2) and calculate
  component completion progress using step-level maths
  So that progress is objective, automatable, and reflects actual BDD
  specification coverage at the granularity of individual Given/When/Then steps

  The MVP derives progress from semver current_version numbers. V1 adds a
  step-based progress system that works with explicitly version-tagged feature
  files. Every feature file is categorised under a version (via the upload API
  or filesystem prefix). The system counts total steps (Given, When, Then, And,
  But) across all features for a version, then compares against passing steps
  from test results to derive a completion percentage.

  Step-based progress formula:
    completion% = (passing_steps / total_steps) * 100

  Where:
    - total_steps = count of all Given/When/Then/And/But lines across all
      feature files tagged with that version for that component
    - passing_steps = count of steps in scenarios that passed in the most
      recent test run for that version

  A scenario's steps only count as passing if the entire scenario passed.
  Partially passing scenarios contribute 0 passing steps (fail-fast semantics).

  # ── Step Counting from Feature Files ────────────────────────────────

  Rule: The system counts individual steps from Gherkin feature content

    Scenario: Count steps in a simple feature file
      Given a feature file with content:
        """
        Feature: Simple Feature
          Scenario: Basic flow
            Given a user exists
            When the user logs in
            Then the dashboard is displayed
        """
      When the step counter processes the file
      Then the total step count is 3
      And the given step count is 1
      And the when step count is 1
      And the then step count is 1

    Scenario: And/But steps are counted as steps
      Given a feature file with content:
        """
        Feature: And/But Steps
          Scenario: Complex assertions
            Given a user exists
            And the user has admin role
            When the user accesses settings
            Then the settings page loads
            And the admin panel is visible
            But the delete button is hidden
        """
      When the step counter processes the file
      Then the total step count is 6

    Scenario: Count steps across multiple scenarios
      Given a feature file with content:
        """
        Feature: Multi-Scenario
          Scenario: First
            Given step one
            When step two
            Then step three

          Scenario: Second
            Given step four
            When step five
            Then step six
            And step seven
        """
      When the step counter processes the file
      Then the total step count is 7

    Scenario: Count steps in Scenario Outline (template counts once)
      Given a feature file with content:
        """
        Feature: Outline Feature
          Scenario Outline: Parameterised
            Given a <role> user
            When the user performs <action>
            Then the result is <outcome>

            Examples:
              | role  | action | outcome |
              | admin | edit   | success |
              | guest | edit   | denied  |
        """
      When the step counter processes the file
      Then the total step count is 3
      And the step count reflects the template, not the expanded examples

    Scenario: Count steps within Rule blocks
      Given a feature file with content:
        """
        Feature: Rules Feature
          Rule: Authentication
            Scenario: Login
              Given credentials
              When I submit them
              Then I am logged in

          Rule: Authorisation
            Scenario: Access check
              Given I am logged in
              And I have role "admin"
              When I access the resource
              Then access is granted
        """
      When the step counter processes the file
      Then the total step count is 7

    Scenario: Background steps are counted once per feature
      Given a feature file with content:
        """
        Feature: Background Feature
          Background:
            Given a database connection
            And the schema is initialised

          Scenario: Read data
            When I query the database
            Then results are returned

          Scenario: Write data
            When I insert a record
            Then the record exists
        """
      When the step counter processes the file
      Then the total step count is 6
      And the background steps count as 2 (not multiplied by scenarios)

    Scenario: Steps with docstrings count as one step each
      Given a feature file with content:
        """
        Feature: Docstring Feature
          Scenario: Upload content
            Given the API is running
            When I upload with body:
              \"\"\"
              {"key": "value"}
              \"\"\"
            Then the response status is 200
        """
      When the step counter processes the file
      Then the total step count is 3

    Scenario: Steps with data tables count as one step each
      Given a feature file with content:
        """
        Feature: Table Feature
          Scenario: Tabular data
            Given these users exist:
              | name  | role  |
              | Alice | admin |
              | Bob   | user  |
            When I list users
            Then I see 2 users
        """
      When the step counter processes the file
      Then the total step count is 3

    Scenario: Empty feature file has 0 steps
      Given a feature file with no scenarios
      When the step counter processes the file
      Then the total step count is 0

  # ── Aggregated Step Counts Per Component Per Version ────────────────

  Rule: Step counts are aggregated across all features for a component version

    Scenario: Aggregate steps across multiple features for a version
      Given component "agg-comp" has these features under version "v1":
        | filename              | step_count |
        | auth.feature          | 12         |
        | permissions.feature   | 8          |
        | rate-limiting.feature | 15         |
      When I query the step totals for "agg-comp" version "v1"
      Then the total steps are 35
      And the feature count is 3

    Scenario: Step counts are independent per version
      Given component "ver-steps" has:
        | version | total_steps |
        | mvp     | 20          |
        | v1      | 45          |
        | v2      | 30          |
      When I query the step totals for each version
      Then the "mvp" total is 20 steps
      And the "v1" total is 45 steps
      And the "v2" total is 30 steps

    Scenario: Component with no features for a version has 0 total steps
      Given component "no-feat" has features under "mvp" but none under "v1"
      When I query the step totals for "no-feat" version "v1"
      Then the total steps are 0
      And the feature count is 0

    Scenario: Adding a feature updates the aggregated step count
      Given component "add-feat" has 20 total steps under version "v1"
      When a new feature with 8 steps is uploaded under version "v1"
      Then the total steps for "add-feat" version "v1" become 28

    Scenario: Removing a feature updates the aggregated step count
      Given component "rm-feat" has 30 total steps under version "v1" across 3 features
      When a feature with 10 steps is deleted from version "v1"
      Then the total steps for "rm-feat" version "v1" become 20

  # ── Step-Based Progress Calculation ─────────────────────────────────

  Rule: Progress is calculated as passing_steps / total_steps * 100

    Scenario: 100% progress when all steps pass
      Given component "full-pass" has 20 total steps under version "mvp"
      And test results show 20 of 20 steps passing
      When I calculate step-based progress for "full-pass" version "mvp"
      Then the progress is 100 percent
      And the status is "complete"

    Scenario: 0% progress when no test results exist
      Given component "no-tests" has 15 total steps under version "v1"
      And no test results exist for "no-tests" version "v1"
      When I calculate step-based progress for "no-tests" version "v1"
      Then the progress is 0 percent
      And the status is "planned"

    Scenario: Partial progress with some scenarios passing
      Given component "partial" has 40 total steps under version "v1"
      And test results show scenarios containing 30 steps passed
      And scenarios containing 10 steps failed
      When I calculate step-based progress for "partial" version "v1"
      Then the progress is 75 percent
      And the status is "in-progress"

    Scenario: Failed scenario contributes 0 passing steps
      Given component "fail-scenario" has a feature with 2 scenarios:
        | scenario   | steps | passed |
        | Scenario A | 5     | yes    |
        | Scenario B | 5     | no     |
      When I calculate step-based progress for "fail-scenario"
      Then the passing steps are 5 (only from Scenario A)
      And the total steps are 10
      And the progress is 50 percent

    Scenario: 0% progress when all scenarios fail
      Given component "all-fail" has 25 total steps under version "mvp"
      And test results show 0 scenarios passing
      When I calculate step-based progress for "all-fail" version "mvp"
      Then the progress is 0 percent
      And the status is "planned"

    Scenario: 0% progress when component has 0 total steps
      Given component "empty-comp" has 0 total steps under version "v1"
      When I calculate step-based progress for "empty-comp" version "v1"
      Then the progress is 0 percent
      And the status is "planned"

    Scenario: Progress rounds to nearest integer
      Given component "round-comp" has 3 total steps under version "mvp"
      And test results show 2 steps passing
      When I calculate step-based progress for "round-comp" version "mvp"
      Then the progress is 67 percent (rounded from 66.67)

    Scenario: Progress is capped at 100
      Given step counts and results that could produce over 100
      When I calculate step-based progress
      Then the progress is exactly 100
      And the status is "complete"

  # ── Recording Step-Level Test Results ───────────────────────────────

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

  # ── Combined Progress (Semver + Steps) ──────────────────────────────

  Rule: Final progress blends semver-derived and step-based sources

    Scenario: Combined progress with configurable weights
      Given the progress configuration has weights:
        | source        | weight |
        | semver        | 0.3    |
        | step_coverage | 0.7    |
      And component "weighted" has:
        | source                | value |
        | semver progress       | 50    |
        | step-based progress   | 80    |
      When I calculate combined progress for "weighted" version "mvp"
      Then the combined progress is 71 percent
      And the calculation is round((50 * 0.3) + (80 * 0.7)) = 71

    Scenario: Default weights are 50/50
      Given no custom progress configuration exists
      And component "default" has:
        | source                | value |
        | semver progress       | 60    |
        | step-based progress   | 40    |
      When I calculate combined progress for "default" version "mvp"
      Then the combined progress is 50 percent

    Scenario: No features falls back to semver-only progress
      Given component "no-feat" has current_version "0.7.0"
      And no feature files exist under any version
      When I calculate combined progress for "no-feat" version "mvp"
      Then the combined progress is 70 percent
      And the progress source is "semver_only"

    Scenario: No current_version falls back to step-based-only progress
      Given component "no-ver" has no current_version
      And step-based progress for "no-ver" version "mvp" is 60 percent
      When I calculate combined progress for "no-ver" version "mvp"
      Then the combined progress is 60 percent
      And the progress source is "step_coverage_only"

    Scenario: Neither source available gives 0% progress
      Given component "empty" has no current_version and no features
      When I calculate combined progress for "empty" version "mvp"
      Then the combined progress is 0 percent
      And the status is "planned"

    Scenario: Status derived from combined progress
      Then the following status derivation applies:
        | combined_progress | status      |
        | 0                 | planned     |
        | 1-99              | in-progress |
        | 100               | complete    |

  # ── Progress Configuration ──────────────────────────────────────────

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

  # ── Progress Dashboard Data ─────────────────────────────────────────

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

  # ── Automatic Progress Recalculation ────────────────────────────────

  Rule: Progress is recalculated when features or test results change

    Scenario: Uploading a feature triggers step recount and progress update
      Given component "recalc-up" has 20 total steps under version "v1" with 20 passing
      And progress is 100 percent
      When I upload a new feature with 10 steps under version "v1"
      Then total steps become 30
      And passing steps remain 20 (new feature has no test results)
      And progress drops to 67 percent

    Scenario: Deleting a feature triggers step recount and progress update
      Given component "recalc-del" has 30 total steps under version "v1"
      And 20 of those steps are in passing scenarios
      And progress is 67 percent
      When I delete a feature with 10 failing steps
      Then total steps become 20
      And passing steps remain 20
      And progress increases to 100 percent

    Scenario: Updating current_version triggers semver progress recalculation
      Given component "recalc-ver" has current_version "0.5.0"
      When I update current_version to "0.8.0"
      Then the semver-derived progress for "mvp" becomes 80
      And the combined progress is recalculated

    Scenario: Recording test results triggers step progress recalculation
      Given component "recalc-test" has step progress at 60 percent
      When I record new test results with more passing scenarios
      Then the step progress is recalculated
      And the combined progress is recalculated

    Scenario: Replacing a feature recounts steps correctly
      Given component "recalc-replace" has feature "auth.feature" under version "v1" with 8 steps
      And total steps for version "v1" are 20
      When I upload a new version of "auth.feature" under version "v1" with 12 steps
      Then total steps for version "v1" become 24 (20 - 8 + 12)
      And passing steps are recalculated based on latest test results

  # ── Progress in Architecture Export ─────────────────────────────────

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

  # ── Filesystem Feature File Watching ────────────────────────────────

  Rule: Changes to feature files on disk trigger step recount and progress update

    Scenario: New feature file triggers step recount
      Given the feature file watcher is running
      And a new file "components/test-comp/features/v1-new.feature" with 8 steps is created
      When the watcher detects the new file
      Then the file is stored under version "v1" (from filename prefix)
      And total steps for "test-comp" version "v1" increase by 8
      And progress is recalculated

    Scenario: Modified feature file triggers step recount
      Given the feature file watcher is running
      And "components/test-comp/features/mvp-auth.feature" changes from 5 to 9 steps
      When the watcher detects the modification
      Then the step count for that feature updates to 9
      And total steps for "test-comp" version "mvp" are recalculated
      And progress is recalculated

    Scenario: Deleted feature file triggers step recount
      Given the feature file watcher is running
      And "components/test-comp/features/v1-old.feature" with 6 steps is deleted
      When the watcher detects the deletion
      Then total steps for "test-comp" version "v1" decrease by 6
      And progress is recalculated

    Scenario: Watcher can be triggered manually via API
      Given the API server is running
      And a valid API key with scope "admin"
      When I send a POST request to "/api/admin/scan-features"
      Then the response status is 200
      And the response body includes per-version step totals:
        | field               | description                    |
        | scanned             | Total files processed          |
        | added               | New features found             |
        | updated             | Modified features updated      |
        | removed             | Deleted features cleaned up    |
        | step_totals.mvp     | Total MVP steps after scan     |
        | step_totals.v1      | Total V1 steps after scan      |
        | step_totals.v2      | Total V2 steps after scan      |

    Scenario: Watcher ignores non-feature files
      Given the feature file watcher is running
      And a file "components/test-comp/features/README.md" is created
      When the watcher processes the event
      Then no feature is added to the database
      And no step recount occurs

    Scenario: Watcher debounces rapid successive changes
      Given the feature file watcher is running
      When 10 feature files are modified within 500 milliseconds
      Then the watcher batches the changes
      And triggers a single re-scan after a 1-second debounce period
      And step counts are recalculated once for all 10 files
