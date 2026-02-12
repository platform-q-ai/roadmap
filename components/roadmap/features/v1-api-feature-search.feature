@wip @v1
Feature: API Feature Content Search
  As an LLM engineer working autonomously
  I want to search feature content across all components
  So that I can find relevant specifications by keyword

  Rule: Feature content can be searched across all components

    Scenario: Search features by keyword
      Given the API server is running
      And a valid API key with scope "read"
      And features exist containing the word "authentication"
      When I send a GET request to "/api/features/search?q=authentication"
      Then the response status is 200
      And the response body is an array of matching features
      And each result has fields: node_id, filename, version, title, step_count, snippet

    Scenario: Search with no results returns empty array
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/features/search?q=xyznonexistent"
      Then the response status is 200
      And the response body is an empty array

    Scenario: Search is case-insensitive
      Given the API server is running
      And a valid API key with scope "read"
      And a feature contains "Neo4j"
      When I send a GET request to "/api/features/search?q=neo4j"
      Then the response body contains the matching feature

    Scenario: Search can be scoped to a version
      Given the API server is running
      And a valid API key with scope "read"
      When I send a GET request to "/api/features/search?q=test&version=v1"
      Then every result in the response has version "v1"

    Scenario: Search returns snippet with highlighted match
      Given the API server is running
      And a valid API key with scope "read"
      And a feature contains "rate limiting"
      When I send a GET request to "/api/features/search?q=rate+limiting"
      Then each result has a "snippet" field showing context around the match
