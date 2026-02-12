@wip @v1
Feature: Combined Progress (Semver + Steps)
  As the roadmap application
  I want to blend semver-derived and step-based progress sources
  So that final progress reflects both version milestones and BDD coverage

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
