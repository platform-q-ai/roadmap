Feature: Environment Variable Hygiene
  As an open-source contributor cloning the repository
  I want a documented .env.example and proof that secrets stay out of git
  So that I can configure the project without guessing variable names

  # -- .env.example existence and content --------------------------------

  Scenario: .env.example exists in the repository root
    Given the project source directory
    Then a file ".env.example" exists in the project

  Scenario: .env.example documents every required environment variable
    Given the project source directory
    Then the ".env.example" file lists the variable "DB_PATH"
    And the ".env.example" file lists the variable "PORT"
    And the ".env.example" file lists the variable "ALLOWED_ORIGINS"
    And the ".env.example" file lists the variable "API_KEY_SEED"

  Scenario: .env.example contains only placeholder values
    Given the project source directory
    Then the ".env.example" file does not contain real secrets

  # -- .gitignore guards --------------------------------------------------

  Scenario: .gitignore excludes .env files
    Given the project source directory
    Then the ".gitignore" file contains a line matching ".env"

  Scenario: Real .env file has never been committed to git history
    Given the project source directory
    Then the git history does not contain a committed ".env" file
