Feature: Delete a single feature file via API
  As an API consumer
  I want to delete a specific feature file from a component
  So that I can remove outdated or incorrect BDD specs without affecting other features

  Background:
    Given the API server is running

  # ── Happy path ──────────────────────────────────────────────────────

  Scenario: Delete an existing feature file returns 204
    Given a component "df-comp" exists in the database
    And the component "df-comp" has a feature "mvp-example.feature"
    When I send a DELETE request to "/api/components/df-comp/features/mvp-example.feature"
    Then the response status is 204

  Scenario: Deleted feature is no longer returned by GET
    Given a component "df-verify" exists in the database
    And the component "df-verify" has a feature "mvp-gone.feature"
    When I send a DELETE request to "/api/components/df-verify/features/mvp-gone.feature"
    And I send a GET request to "/api/components/df-verify/features"
    Then the response status is 200
    And the response body does not include feature "mvp-gone.feature"

  Scenario: Other features for the same component are not affected
    Given a component "df-multi" exists in the database
    And the component "df-multi" has a feature "mvp-keep.feature"
    And the component "df-multi" has a feature "mvp-remove.feature"
    When I send a DELETE request to "/api/components/df-multi/features/mvp-remove.feature"
    And I send a GET request to "/api/components/df-multi/features"
    Then the response status is 200
    And the response body includes feature "mvp-keep.feature"
    And the response body does not include feature "mvp-remove.feature"

  # ── Error cases ─────────────────────────────────────────────────────

  Scenario: Delete feature for nonexistent component returns 404
    When I send a DELETE request to "/api/components/ghost-comp/features/mvp-test.feature"
    Then the response status is 404
    And the response body has field "error"

  Scenario: Delete nonexistent feature file returns 404
    Given a component "df-nofile" exists in the database
    When I send a DELETE request to "/api/components/df-nofile/features/mvp-missing.feature"
    Then the response status is 404
    And the response body has field "error"
