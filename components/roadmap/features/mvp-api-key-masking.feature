Feature: API Key Masking in Seed Logs
  As a developer reviewing server startup logs
  I want all seeded API keys to be masked in log output
  So that secrets are never exposed in plaintext in logs

  # ── Masking behaviour ──────────────────────────────────────

  Scenario: Deterministic keys are masked in log output
    Given a seed entry with a deterministic key "rmap_abcdef1234567890abcdef1234567890"
    When the key is seeded successfully
    Then the log output contains a masked form of the key
    And the log output does not contain the full plaintext key

  Scenario: Auto-generated keys are also masked in log output
    Given a seed entry without an explicit key
    When the key is seeded and the generated key is "rmap_random9876543210abcdef9876543210"
    Then the log output contains a masked form of the key
    And the log output does not contain the full plaintext key

  Scenario: Short keys are masked with asterisks
    Given a seed entry with a deterministic key "rmap_short"
    When the key is seeded successfully
    Then the log output contains "rmap_******"
    And the log output does not contain "rmap_short" in the clear
