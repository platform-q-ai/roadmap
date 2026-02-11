Feature: Docker-based Render Deployment
  As an operator deploying the roadmap application to Render
  I want the service to use a Docker runtime with sqlite3 installed
  So that the build step can create the SQLite database

  # ── Render Blueprint (Docker) ──────────────────────────────────────

  Scenario: render.yaml specifies Docker runtime
    Given the project source directory
    Then a file "render.yaml" exists in the project
    And the render.yaml specifies a web service
    And the render.yaml specifies the Docker runtime
    And the render.yaml does not specify a Node.js runtime

  # ── Dockerfile ─────────────────────────────────────────────────────

  Scenario: Dockerfile exists in project root
    Given the project source directory
    Then a file "Dockerfile" exists in the project

  Scenario: Dockerfile uses Node.js base image
    Given the project source directory
    Then the Dockerfile has a FROM instruction with a Node.js image

  Scenario: Dockerfile installs sqlite3 system package
    Given the project source directory
    Then the Dockerfile installs sqlite3 via apt-get

  Scenario: Dockerfile copies package files and installs dependencies
    Given the project source directory
    Then the Dockerfile copies package manifest files
    And the Dockerfile runs npm ci

  Scenario: Dockerfile copies source and builds the project
    Given the project source directory
    Then the Dockerfile copies the application source
    And the Dockerfile runs the build command

  Scenario: Dockerfile exposes the service port
    Given the project source directory
    Then the Dockerfile exposes port 3000

  Scenario: Dockerfile specifies the start command
    Given the project source directory
    Then the Dockerfile has a CMD or ENTRYPOINT for npm start

  # ── .dockerignore ──────────────────────────────────────────────────

  Scenario: .dockerignore exists and excludes build artifacts
    Given the project source directory
    Then a file ".dockerignore" exists in the project
    And the .dockerignore excludes "node_modules"
    And the .dockerignore excludes "dist"
    And the .dockerignore excludes ".git"
