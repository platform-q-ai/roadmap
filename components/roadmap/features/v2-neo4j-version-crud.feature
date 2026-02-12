@wip @v2
Feature: Neo4j Version CRUD
  As the roadmap application
  I want to create, read, update, and delete version records in Neo4j
  So that the version repository contract is fulfilled by the graph database

  Rule: Neo4j version repository implements IVersionRepository

    Scenario: Save a new version
      Given a node "ver-node" exists in Neo4j
      When I save a version for "ver-node" with version "mvp" and progress 50
      Then a Neo4j node labelled "Version" exists with node_id "ver-node" and version "mvp"
      And the version has progress 50

    Scenario: Version upsert updates content and progress
      Given a version "mvp" exists for node "ver-node" with progress 30
      When I save a version for "ver-node" with version "mvp" and progress 70
      Then the version "mvp" for "ver-node" has progress 70
      And only one version "mvp" exists for "ver-node"

    Scenario: Find all versions
      Given versions exist for multiple nodes
      When I call findAll on the version repository
      Then the result contains all versions ordered by node_id and version

    Scenario: Find versions by node
      Given node "multi-ver" has versions "overview", "mvp", "v1", "v2"
      When I call findByNode with "multi-ver"
      Then the result contains 4 versions
      And all versions have node_id "multi-ver"

    Scenario: Find version by node and version tag
      Given node "specific-ver" has version "v1" with content "V1 spec"
      When I call findByNodeAndVersion with "specific-ver" and "v1"
      Then the result has content "V1 spec"

    Scenario: Update progress and status via save
      Given node "prog-node" has version "mvp" with progress 0 and status "planned"
      When I call save with node "prog-node", version "mvp", progress 50, status "in-progress"
      Then the version has progress 50 and status "in-progress"
      And the updated_at timestamp is refreshed

    Scenario: Delete all versions for a node
      Given node "del-ver" has versions "overview", "mvp", "v1"
      When I call deleteByNode with "del-ver"
      Then no versions exist for "del-ver"
