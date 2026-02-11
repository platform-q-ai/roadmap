Feature: Render Deployment
  As an operator deploying the roadmap application
  I want the app configured for Render hosting
  So that I can deploy both the API and web view as a single service

  # ── Static File Serving ──────────────────────────────────────────────

  Scenario: API server serves index.html at root
    Given the API server is running with static file serving
    When I request the path "/"
    Then the render response status is 200
    And the render response content type contains "text/html"

  Scenario: API server serves data.json from web directory
    Given the API server is running with static file serving
    When I request the path "/data.json"
    Then the render response status is 200
    And the render response content type contains "application/json"

  Scenario: API routes still work alongside static serving
    Given the API server is running with static file serving
    When I request the path "/api/health"
    Then the render response status is 200
    And the render response body has field "status" with value "ok"

  Scenario: Unknown static file returns 404
    Given the API server is running with static file serving
    When I request the path "/nonexistent-file.xyz"
    Then the render response status is 404

  Scenario: Path traversal attempts are rejected
    Given the API server is running with static file serving
    When I request the path "/../package.json"
    Then the render response status is 404

  # ── Render Blueprint ─────────────────────────────────────────────────

  Scenario: render.yaml exists with required fields
    Given the project source directory
    Then a file "render.yaml" exists in the project
    And the render.yaml specifies a web service
    And the render.yaml specifies the Docker runtime

  # ── Production Start ─────────────────────────────────────────────────

  Scenario: Package.json has a start script for production
    Given the project source directory
    Then the package.json has a "start" script
    And the start script runs the compiled server

  Scenario: Server listens on PORT environment variable
    Given the API server is running with static file serving on a dynamic port
    When I request the path "/api/health"
    Then the render response status is 200

  # ── CORS headers on static files ─────────────────────────────────────

  Scenario: Static file responses include CORS headers
    Given the API server is running with static file serving
    When I request the path "/data.json"
    Then the render response includes CORS headers
