@wip @v1
Feature: Automatic Progress Recalculation
  As the roadmap application
  I want progress to be recalculated when features or test results change
  So that progress is always current and accurate

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
