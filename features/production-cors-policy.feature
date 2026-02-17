Feature: Production CORS Policy
  As the API operator
  I want CORS origins restricted in production deployment
  So that only the legitimate frontend can make cross-origin requests

  # ── Deployment configuration ────────────────────────────────

  Scenario: render.yaml defines ALLOWED_ORIGINS environment variable
    Given the "render.yaml" configuration file
    Then it contains an environment variable "ALLOWED_ORIGINS"
    And the value is not empty

  Scenario: ALLOWED_ORIGINS references the production hostname
    Given the "render.yaml" configuration file
    Then the "ALLOWED_ORIGINS" value contains "https://roadmap-5vvp.onrender.com"
