@v1
Feature: API Version-Scoped Feature Deletion
  As an LLM engineer working autonomously
  I want to delete feature files scoped to their version
  So that I can clean up outdated or incorrect specifications

  Rule: Feature files can be deleted scoped to their version

    Scenario: Delete a single feature by version and filename
      Given the API server is running
      And a valid API key with scope "write"
      And component "del-feat" has feature "remove-me.feature" under version "v1"
      When I send a DELETE request to "/api/components/del-feat/versions/v1/features/remove-me.feature"
      Then the response status is 204
      And the feature "remove-me.feature" under version "v1" no longer exists for "del-feat"

    Scenario: Delete all features for a specific version
      Given the API server is running
      And a valid API key with scope "write"
      And component "del-ver" has 3 "mvp" and 2 "v1" features
      When I send a DELETE request to "/api/components/del-ver/versions/v1/features"
      Then the response status is 204
      And 3 "mvp" features still exist for "del-ver"
      And 0 "v1" features exist for "del-ver"

    Scenario: Delete all features across all versions
      Given the API server is running
      And a valid API key with scope "write"
      And component "del-all" has features under "mvp", "v1", and "v2"
      When I send a DELETE request to "/api/components/del-all/features"
      Then the response status is 204
      And no features exist for "del-all"

    Scenario: Delete nonexistent feature returns 404
      Given the API server is running
      And a valid API key with scope "write"
      When I send a DELETE request to "/api/components/del-feat/versions/v1/features/ghost.feature"
      Then the response status is 404

    Scenario: Deleting features triggers progress recalculation
      Given component "del-recalc" has features under version "v1" contributing to progress
      When I delete all features for "del-recalc" version "v1"
      Then the step-based progress for "del-recalc" version "v1" drops to 0 percent
