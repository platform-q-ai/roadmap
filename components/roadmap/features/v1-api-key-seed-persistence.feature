@v1
Feature: API key seed persistence across deploys
  As an operator deploying the roadmap application
  I want seeded API keys to survive database rebuilds
  So that previously-issued keys remain valid after every deploy

  The API_KEY_SEED environment variable accepts an optional "key" field
  containing a pre-determined plaintext key. When provided, the seeder
  uses that exact plaintext instead of generating a random one. This
  makes the seeding deterministic: the same env var always produces the
  same key hashes, so keys survive container rebuilds.

  Background:
    Given an in-memory API key repository

  # ── Deterministic seeding with pre-set keys ─────────────────────

  Scenario: Seed entry with explicit key uses that plaintext
    Given an API_KEY_SEED entry with name "admin" and key "rmap_fixed_admin_key_abc123"
    When the seed runs
    Then the stored key for "admin" validates against plaintext "rmap_fixed_admin_key_abc123"

  Scenario: Seed entry without explicit key generates a random key
    Given an API_KEY_SEED entry with name "random-key" and no explicit key
    When the seed runs
    Then a key is stored for "random-key"
    And the generated plaintext starts with "rmap_"

  Scenario: Deterministic seed produces identical hashes across runs
    Given an API_KEY_SEED entry with name "stable" and key "rmap_deterministic_key_xyz"
    When the seed runs twice with the same config
    Then the key hash for "stable" is identical both times

  # ── Idempotent re-seeding ───────────────────────────────────────

  Scenario: Re-seeding skips keys that already exist
    Given an API_KEY_SEED entry with name "existing" and key "rmap_existing_key_999"
    And the seed has already run once
    When the seed runs again
    Then no new key is generated for "existing"
    And the original key hash is unchanged

  # ── Validation ──────────────────────────────────────────────────

  Scenario: Seed entry with explicit key validates key format
    Given an API_KEY_SEED entry with name "bad-key" and key "not_valid_prefix"
    When the seed runs
    Then the seed reports a validation error for "bad-key"

  Scenario: Seed entry with empty key string is rejected
    Given an API_KEY_SEED entry with name "empty-key" and key ""
    When the seed runs
    Then the seed reports a validation error for "empty-key"

  # ── Mixed entries ───────────────────────────────────────────────

  Scenario: Seed config with mixed explicit and random keys
    Given an API_KEY_SEED with entries:
      | name      | key                      | scopes     |
      | fixed-one | rmap_fixed_one_aabbccdd  | read       |
      | random-one|                          | read,write |
    When the seed runs
    Then "fixed-one" validates against "rmap_fixed_one_aabbccdd"
    And "random-one" has a generated key starting with "rmap_"

  # ── Log masking ─────────────────────────────────────────────────

  Scenario: Deterministic key is masked in seed logs
    Given an API_KEY_SEED entry with name "secret" and key "rmap_abcdef1234567890abcdef1234567890"
    When the seed runs
    Then the seed log for "secret" shows a masked key
    And the seed log for "secret" does not contain the full plaintext "rmap_abcdef1234567890abcdef1234567890"

  Scenario: Random key is shown in full in seed logs
    Given an API_KEY_SEED entry with name "random-key" and no explicit key
    When the seed runs
    Then the seed log for "random-key" shows the full plaintext

  Scenario: Mixed seed logs mask deterministic and show random
    Given an API_KEY_SEED with entries:
      | name       | key                              | scopes     |
      | fixed-log  | rmap_fixed_log_aabbccdd1234abcd  | read       |
      | random-log |                                  | read,write |
    When the seed runs
    Then the seed log for "fixed-log" shows a masked key
    And the seed log for "random-log" shows the full plaintext

  # ── Parse format ────────────────────────────────────────────────

  Scenario: parseSeedEntries accepts entries with key field
    Given a raw JSON seed string with name "keyed" and key "rmap_abc"
    When the seed entries are parsed
    Then the parsed entry has name "keyed" and key "rmap_abc"

  Scenario: parseSeedEntries accepts entries without key field
    Given a raw JSON seed string with name "unkeyed" and no key
    When the seed entries are parsed
    Then the parsed entry has name "unkeyed" and no key
