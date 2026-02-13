Feature: Live API Web View
  As a user viewing the progression dashboard
  I want the web view to load data from the live API instead of a static JSON file
  So that I see up-to-date architecture data after pushing changes via the API

  Background:
    Given the API server is running

  Scenario: Architecture endpoint is public (no auth required)
    When I send a GET request to "/api/architecture" without authentication
    Then the response status is 200
    And the response body has field "nodes"
    And the response body has field "edges"

  Scenario: Health endpoint remains public
    When I send a GET request to "/api/health" without authentication
    Then the response status is 200
    And the response body has field "status" with value "ok"

  Scenario: Other endpoints still require authentication
    When I send a GET request to "/api/components" without authentication
    Then the response status is 401

  Scenario: Write endpoints still require authentication
    When I send a POST request to "/api/components" without authentication
    Then the response status is 401

  Scenario: Web view fetches from API architecture endpoint
    Given the database contains architecture data
    When the web view initialises
    Then the web view fetches from the API architecture endpoint
    And the web view does not fetch from "data.json"

  Scenario: Web view displays live data from API
    Given the database contains architecture data
    When the web view initialises
    Then the web view receives architecture data with nodes
    And the web view receives architecture data with edges
