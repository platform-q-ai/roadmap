@v1
Feature: Request ID Validation
  As the API operator
  I want client-supplied X-Request-Id values to be validated for length and format
  So that the server is protected from oversized headers and log injection

  Rule: X-Request-Id must be safe and bounded

    Scenario: Valid request ID is accepted
      Given an API server is running with request ID validation
      When I send a request with X-Request-Id "abc-123-def"
      Then the response X-Request-Id is "abc-123-def"

    Scenario: Overlong request ID is replaced with a generated UUID
      Given an API server is running with request ID validation
      When I send a request with an X-Request-Id longer than 128 characters
      Then the response X-Request-Id is a valid UUID

    Scenario: Request ID with unsafe characters is replaced
      Given an API server is running with request ID validation
      When I send a request with X-Request-Id "bad\nvalue<script>"
      Then the response X-Request-Id is a valid UUID

    Scenario: Empty request ID is replaced with a generated UUID
      Given an API server is running with request ID validation
      When I send a request with X-Request-Id ""
      Then the response X-Request-Id is a valid UUID
