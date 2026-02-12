@wip @v1
Feature: API Graph Traversal for Autonomous Coding
  As an LLM engineer working autonomously
  I want graph traversal endpoints to plan implementation order
  So that I can understand dependencies, find next implementable components,
  and navigate the architecture graph headlessly

  Rule: LLM engineers can traverse the graph to plan implementation

    Scenario: Get dependency tree for a component
      Given the API server is running
      And a valid API key with scope "read"
      And component "dep-root" has dependencies "dep-a" and "dep-b"
      And "dep-a" has dependency "dep-c"
      When I send a GET request to "/api/components/dep-root/dependencies?depth=2"
      Then the response status is 200
      And the response body has field "dependencies" as a tree structure
      And the tree includes "dep-a", "dep-b" at depth 1
      And the tree includes "dep-c" at depth 2

    Scenario: Get reverse dependencies (dependents)
      Given the API server is running
      And a valid API key with scope "read"
      And components "consumer-1" and "consumer-2" depend on "provider"
      When I send a GET request to "/api/components/provider/dependents"
      Then the response status is 200
      And the response body contains "consumer-1" and "consumer-2"

    Scenario: Get full component context for coding
      Given the API server is running
      And a valid API key with scope "read"
      And component "context-comp" exists with versions, features, and edges
      When I send a GET request to "/api/components/context-comp/context"
      Then the response status is 200
      And the response body has field "component" with full component details
      And the response body has field "versions" with all version data including step counts
      And the response body has field "features" grouped by version with step counts
      And the response body has field "dependencies" with outbound DEPENDS_ON edges
      And the response body has field "dependents" with inbound DEPENDS_ON edges
      And the response body has field "layer" with the parent layer details
      And the response body has field "siblings" listing other components in the same layer
      And the response body has field "progress" with per-version step-based progress

    Scenario: Get implementation order via topological sort
      Given the API server is running
      And a valid API key with scope "read"
      And a dependency graph with no cycles
      When I send a GET request to "/api/graph/implementation-order"
      Then the response status is 200
      And the response body is an array of component IDs
      And every component appears after all its dependencies
      And the order is a valid topological sort

    Scenario: Implementation order detects cycles
      Given the API server is running
      And a valid API key with scope "read"
      And a circular dependency exists between "cycle-a", "cycle-b", "cycle-c"
      When I send a GET request to "/api/graph/implementation-order"
      Then the response status is 409
      And the response body has field "error" containing "cycle"
      And the response body has field "cycle" listing the involved components

    Scenario: Get components by completion status
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/graph/components-by-status?version=mvp"
      Then the response status is 200
      And the response body has field "complete" as an array of components with 100% step coverage
      And the response body has field "in_progress" as an array with partial step coverage
      And the response body has field "planned" as an array with 0% step coverage

    Scenario: Get next implementable components
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/graph/next-implementable?version=mvp"
      Then the response status is 200
      And the response body is an array of component objects
      And every component has all its dependencies at 100% step coverage for "mvp"
      And every component itself has step coverage below 100% for "mvp"

    Scenario: Get shortest path between two components
      Given the API server is running
      And a valid API key with scope "read"
      And components "path-start" and "path-end" are connected via intermediate nodes
      When I send a GET request to "/api/graph/path?from=path-start&to=path-end"
      Then the response status is 200
      And the response body has field "path" as an array of nodes
      And the response body has field "edges" describing each hop
      And the path is the shortest available route

    Scenario: Path between unconnected components returns empty
      Given the API server is running
      And a valid API key with scope "read"
      And components "island-1" and "island-2" have no connecting path
      When I send a GET request to "/api/graph/path?from=island-1&to=island-2"
      Then the response status is 200
      And the response body has field "path" as an empty array

    Scenario: Get component neighbourhood
      Given the API server is running
      And a valid API key with scope "read"
      And component "center" has edges to and from multiple components
      When I send a GET request to "/api/components/center/neighbourhood?hops=2"
      Then the response status is 200
      And the response body has field "nodes" with all components within 2 hops
      And the response body has field "edges" with all edges between those nodes
      And the response includes the edge types and directions

    Scenario: Get layer overview for planning
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/graph/layer-overview"
      Then the response status is 200
      And the response body is an array of layer summaries
      And each summary has field "layer_id"
      And each summary has field "total_components"
      And each summary has field "completed_mvp" as a count
      And each summary has field "completed_v1" as a count
      And each summary has field "overall_progress" as a percentage
