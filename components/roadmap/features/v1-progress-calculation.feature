@wip @v1
Feature: Step-Based Progress Calculation
  As the roadmap application
  I want to calculate progress as passing_steps / total_steps * 100
  So that component completion is objective and automatable

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
