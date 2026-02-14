Feature: open-dash Live Dashboard (MVP)
  As a developer running multiple OpenCode AI coding instances
  I want a real-time monitoring dashboard
  So that I can see the status, activity, and workspace of every instance at a glance

  open-dash discovers running OpenCode processes via Linux /proc,
  enriches them with session/message data from the OpenCode REST API
  and SQLite fallback, and presents a live-updating web dashboard.

  Background:
    Given the open-dash server is running on port 3333

  Rule: Process Discovery

    Scenario: Discover OpenCode TUI instances via /proc
      Given an OpenCode TUI process is running in "/home/user/project-a"
      When the dashboard scans /proc for opencode processes
      Then the instance appears with type "tui" and the correct working directory

    Scenario: Discover OpenCode server instances via /proc
      Given an OpenCode server process is running with the "serve" argument
      When the dashboard scans /proc for opencode processes
      Then the instance appears with type "server" and its resolved port

    Scenario: Filter out child processes
      Given an OpenCode process has spawned LSP and language server children
      When the dashboard scans /proc for opencode processes
      Then only the parent opencode process is listed

    Scenario: Deduplicate TUI and server on same directory
      Given an OpenCode TUI and server share the same working directory
      When the dashboard merges discovered instances
      Then a single instance is shown with the TUI type and the server port

  Rule: Data Enrichment

    Scenario: Enrich instance via OpenCode REST API
      Given an OpenCode server is accessible at its HTTP port
      When the dashboard fetches session and message data
      Then the instance shows session title, model, and latest messages

    Scenario: Fall back to SQLite when HTTP is unavailable
      Given an OpenCode instance has no accessible HTTP port
      When the dashboard reads from the shared SQLite database
      Then the instance still shows session and message data

  Rule: Busy/Idle Detection

    Scenario: Detect busy via assistant message without completion
      Given an instance has an assistant message with no time.completed
      Then the instance status is "busy"

    Scenario: Detect busy via running tool part
      Given an instance has a tool part with state.status "running"
      Then the instance status is "busy"

    Scenario: Detect idle when no active work
      Given an instance has all messages completed and no running tools
      Then the instance status is "idle"

  Rule: Dashboard UI

    Scenario: Display stats bar with instance counts
      Given 3 OpenCode instances are discovered (2 TUI, 1 server, 1 busy)
      When the dashboard renders
      Then the stats bar shows total 3, TUI 2, server 1, busy 1, idle 2

    Scenario: Show git branch badge on each card
      Given an instance is working in a git repository on branch "feat/auth"
      When the dashboard renders the instance card
      Then the card shows a git branch badge with "feat/auth"

    Scenario: Pin instance to top
      Given the dashboard is showing multiple instance cards
      When the user clicks the pin icon on an instance
      Then the instance moves to the top of the list
      And the pin state is persisted to localStorage

    Scenario: Sort by busy-first
      Given instances with mixed busy and idle statuses
      When the user selects "Busy-first" sort mode
      Then busy instances appear above idle instances

    Scenario: DOM diffing skips unchanged cards
      Given an instance card is currently rendered
      When the next poll returns identical data for that instance
      Then the card DOM is not re-rendered

  Rule: API Endpoints

    Scenario: Health check endpoint
      When a GET request is made to /health
      Then the response status is 200
      And the body contains a health status

    Scenario: Dashboard JSON endpoint
      When a GET request is made to /api/dashboard
      Then the response contains instances array, serverHealth, and lastUpdated

    Scenario: Read-only -- no mutation endpoints
      Given the open-dash server is running
      Then it exposes no POST, PUT, or DELETE endpoints
      And all data access is via GET requests
