Feature: Progress Tracking
  As a project manager
  I want to update the progress and status of component versions
  So that the roadmap reflects current implementation state

  Background:
    Given a database with architecture data

  Scenario: Update progress for an existing node version
    Given a component node "supervisor" exists
    And a version "mvp" exists for node "supervisor"
    When I update progress for node "supervisor" version "mvp" to 50 percent with status "in-progress"
    Then the version repository receives the update

  Scenario: Reject update for a nonexistent node
    Given no node with id "ghost" exists
    When I update progress for node "ghost" version "mvp" to 10 percent with status "planned"
    Then the operation fails with error "Node not found: ghost"

  Scenario: Reject progress below zero
    Given a component node "supervisor" exists
    When I update progress for node "supervisor" version "mvp" to -5 percent with status "planned"
    Then the operation fails with error "Progress must be 0-100"

  Scenario: Reject progress above one hundred
    Given a component node "supervisor" exists
    When I update progress for node "supervisor" version "mvp" to 150 percent with status "planned"
    Then the operation fails with error "Progress must be 0-100"

  Scenario: Accept progress at boundary values
    Given a component node "supervisor" exists
    When I update progress for node "supervisor" version "mvp" to 0 percent with status "planned"
    Then the version repository receives the update
    When I update progress for node "supervisor" version "mvp" to 100 percent with status "complete"
    Then the version repository receives the update

  Scenario: Reject an invalid status value
    Given a component node "supervisor" exists
    When I update progress for node "supervisor" version "mvp" to 50 percent with status "invalid-status"
    Then the operation fails with error "Status must be one of"
