@wip @v1
Feature: Aggregated Step Counts Per Component Per Version
  As the roadmap application
  I want step counts aggregated across all features for a component version
  So that progress is calculated from the complete feature set

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
