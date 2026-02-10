Feature: Context Rebuilder (MVP)
  On crash recovery, the Context Rebuilder generates a resume
  prompt from the last checkpoint so the agent can continue.

  Background:
    Given the State Store contains checkpoints for a crashed agent

  Scenario: Generate resume prompt for Worker
    Given the Worker crashed mid-task on task "Create login endpoint"
    And the last checkpoint shows 3 completed tool calls
    When the Context Rebuilder generates a resume prompt
    Then the prompt includes "you were doing: Create login endpoint"
    And it lists the 3 completed tool calls with their results
    And it states the next expected action

  Scenario: Generate resume prompt for Meta-Agent
    Given the Meta-Agent crashed while processing goal "Build auth"
    And the goal has 5 tasks, 2 completed and 1 in-progress
    When the Context Rebuilder generates a resume prompt
    Then the prompt includes the current goal state
    And it lists completed and pending tasks
    And it states the current Worker status

  Scenario: Handle empty checkpoint
    Given no checkpoints exist for the crashed agent
    When the Context Rebuilder generates a resume prompt
    Then it produces a minimal prompt with no prior context
    And the agent starts fresh
