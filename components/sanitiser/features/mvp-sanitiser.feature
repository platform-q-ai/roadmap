Feature: 3-Stage Sanitiser (MVP)
  The Sanitiser sits between the Worker's MCP proxy and downstream
  tool servers. It scans tool responses for injection attempts.

  Background:
    Given the Sanitiser is running as an isolated subprocess

  Scenario: Pass clean tool response
    Given a tool response contains normal text content
    When the Sanitiser processes the response
    Then the verdict is "pass"
    And the response is forwarded to the Worker unchanged

  Scenario: Block response with injection pattern
    Given a tool response contains "ignore previous instructions"
    When the Sanitiser processes the response
    Then the verdict is "block"
    And the response is not forwarded to the Worker
    And the injection event is logged to the State Store

  Scenario: Strip role tags from response
    Given a tool response contains "<system>" tags
    When the Sanitiser applies structural stripping
    Then the role tags are removed from the response
    And the cleaned response is forwarded

  Scenario: Cap response length
    Given a tool response exceeds the maximum allowed length
    When the Sanitiser processes the response
    Then the response is truncated to the maximum length
    And the truncation is noted in the log

  Scenario: Fail closed on processing error
    Given the Sanitiser encounters an internal error during processing
    When processing a tool response
    Then the response is blocked (not forwarded)
    And the error is logged
