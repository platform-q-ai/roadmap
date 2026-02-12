@wip @v1
Feature: API Component Partial Update
  As an LLM engineer using the roadmap API headlessly
  I want to partially update components via PATCH
  So that I can modify individual fields without resending the entire component

  Rule: Components can be partially updated via PATCH

    Scenario: Update component name
      Given the API server is running
      And a valid API key with scope "write"
      And a component "patch-comp" exists
      When I send a PATCH request to "/api/components/patch-comp" with body:
        """
        {"name":"Updated Name"}
        """
      Then the response status is 200
      And the response body has field "name" with value "Updated Name"
      And the response body has field "id" with value "patch-comp"

    Scenario: Update component description
      Given the API server is running
      And a valid API key with scope "write"
      And a component "desc-comp" exists
      When I send a PATCH request to "/api/components/desc-comp" with body:
        """
        {"description":"New description for the component"}
        """
      Then the response status is 200
      And the response body has field "description" with value "New description for the component"

    Scenario: Update component tags
      Given the API server is running
      And a valid API key with scope "write"
      And a component "tag-comp" exists with tags ["old"]
      When I send a PATCH request to "/api/components/tag-comp" with body:
        """
        {"tags":["new","updated"]}
        """
      Then the response status is 200
      And the response body has field "tags" containing "new" and "updated"

    Scenario: Update component sort_order
      Given the API server is running
      And a valid API key with scope "write"
      And a component "sort-comp" exists with sort_order 10
      When I send a PATCH request to "/api/components/sort-comp" with body:
        """
        {"sort_order":99}
        """
      Then the response status is 200
      And the response body has field "sort_order" with value "99"

    Scenario: Update component current_version
      Given the API server is running
      And a valid API key with scope "write"
      And a component "ver-comp" exists with current_version null
      When I send a PATCH request to "/api/components/ver-comp" with body:
        """
        {"current_version":"0.5.0"}
        """
      Then the response status is 200
      And the response body has field "current_version" with value "0.5.0"

    Scenario: Update component current_version triggers progress recalculation
      Given the API server is running
      And a valid API key with scope "write"
      And a component "recalc-comp" exists with version "mvp" at progress 0
      When I send a PATCH request to "/api/components/recalc-comp" with body:
        """
        {"current_version":"0.7.5"}
        """
      Then the response status is 200
      And the version "mvp" for "recalc-comp" now has derived progress 75

    Scenario: Reject update with invalid current_version format
      Given the API server is running
      And a valid API key with scope "write"
      And a component "bad-ver-comp" exists
      When I send a PATCH request to "/api/components/bad-ver-comp" with body:
        """
        {"current_version":"not-semver"}
        """
      Then the response status is 400
      And the response body has field "error" containing "version"

    Scenario: Update nonexistent component returns 404
      Given the API server is running
      And a valid API key with scope "write"
      When I send a PATCH request to "/api/components/ghost" with body:
        """
        {"name":"Ghost"}
        """
      Then the response status is 404

    Scenario: Update preserves unmodified fields
      Given the API server is running
      And a valid API key with scope "write"
      And a component "preserve-comp" exists with name "Original" and description "Keep me"
      When I send a PATCH request to "/api/components/preserve-comp" with body:
        """
        {"name":"Changed"}
        """
      Then the response body has field "name" with value "Changed"
      And the response body has field "description" with value "Keep me"
