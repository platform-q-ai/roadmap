Feature: Sync roadmap current_version from package.json
  As a project maintainer
  I want the roadmap component's current_version to be read from package.json
  So that bumping package.json is the single source of truth for the project version

  The roadmap node is the self-tracking component. Its current_version
  drives derived progress for all its version phases (MVP, v1, v2).
  Instead of hardcoding the version in the database, the system should
  read it from package.json at assembly time.

  Rule: GetArchitecture accepts an optional package version

    Background:
      Given an architecture graph with nodes and versions

    Scenario: Package version overrides roadmap node's current_version
      Given a node "roadmap" with current_version "0.7.5" exists in the database
      And a version "mvp" with manual progress 0 exists for "roadmap"
      And the package version is "1.0.0"
      When I assemble the architecture with the package version
      Then the enriched node "roadmap" should have current_version "1.0.0"

    Scenario: Package version updates derived progress for roadmap
      Given a node "roadmap" with current_version "0.7.5" exists in the database
      And a version "mvp" with manual progress 0 exists for "roadmap"
      And the package version is "1.0.0"
      When I assemble the architecture with the package version
      Then the version "mvp" for node "roadmap" should have progress 100
      And the version "mvp" for node "roadmap" should have status "complete"

    Scenario: Other nodes are not affected by the package version
      Given a node "roadmap" with current_version "0.7.5" exists in the database
      And a node "worker" with current_version "0.3.0" exists in the database
      And a version "mvp" with manual progress 0 exists for "worker"
      And the package version is "1.0.0"
      When I assemble the architecture with the package version
      Then the version "mvp" for node "worker" should have progress 30

    Scenario: No package version preserves database value
      Given a node "roadmap" with current_version "0.7.5" exists in the database
      And a version "mvp" with manual progress 0 exists for "roadmap"
      When I assemble the architecture
      Then the enriched node "roadmap" should have current_version "0.7.5"
      And the version "mvp" for node "roadmap" should have progress 75

    Scenario: Package version applies to roadmap in progression tree
      Given a node "roadmap" with current_version "0.7.5" exists in the database
      And the package version is "1.0.0"
      When I assemble the architecture with the package version
      Then the enriched node "roadmap" should have display_state "v1"

    Scenario: Null package version treated as absent
      Given a node "roadmap" with current_version "0.7.5" exists in the database
      And a version "mvp" with manual progress 0 exists for "roadmap"
      And the package version is null
      When I assemble the architecture with the package version
      Then the enriched node "roadmap" should have current_version "0.7.5"

  Rule: API adapter reads from package.json

    Scenario: API adapter reads version from package.json
      Given the project source directory
      Then the file "src/adapters/api/start.ts" contains "package.json"
