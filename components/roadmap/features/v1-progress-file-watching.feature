@wip @v1
Feature: Filesystem Feature File Watching
  As the roadmap application
  I want changes to feature files on disk to trigger step recount and progress update
  So that progress stays in sync with the filesystem without manual intervention

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
