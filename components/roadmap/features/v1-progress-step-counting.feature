@wip @v1
Feature: Step Counting from Feature Files
  As the roadmap application
  I want to count individual Given/When/Then steps from Gherkin feature content
  So that step totals can be used for progress calculation

  Step-based progress formula:
    completion% = (passing_steps / total_steps) * 100

  Where:
    - total_steps = count of all Given/When/Then/And/But lines across all
      feature files tagged with that version for that component
    - passing_steps = count of steps in scenarios that passed in the most
      recent test run for that version

  A scenario's steps only count as passing if the entire scenario passed.
  Partially passing scenarios contribute 0 passing steps (fail-fast semantics).

  Rule: The system counts individual steps from Gherkin feature content

    Scenario: Count steps in a simple feature file
      Given a feature file with content:
        """
        Feature: Simple Feature
          Scenario: Basic flow
            Given a user exists
            When the user logs in
            Then the dashboard is displayed
        """
      When the step counter processes the file
      Then the total step count is 3
      And the given step count is 1
      And the when step count is 1
      And the then step count is 1

    Scenario: And/But steps are counted as steps
      Given a feature file with content:
        """
        Feature: And/But Steps
          Scenario: Complex assertions
            Given a user exists
            And the user has admin role
            When the user accesses settings
            Then the settings page loads
            And the admin panel is visible
            But the delete button is hidden
        """
      When the step counter processes the file
      Then the total step count is 6

    Scenario: Count steps across multiple scenarios
      Given a feature file with content:
        """
        Feature: Multi-Scenario
          Scenario: First
            Given step one
            When step two
            Then step three

          Scenario: Second
            Given step four
            When step five
            Then step six
            And step seven
        """
      When the step counter processes the file
      Then the total step count is 7

    Scenario: Count steps in Scenario Outline (template counts once)
      Given a feature file with content:
        """
        Feature: Outline Feature
          Scenario Outline: Parameterised
            Given a <role> user
            When the user performs <action>
            Then the result is <outcome>

            Examples:
              | role  | action | outcome |
              | admin | edit   | success |
              | guest | edit   | denied  |
        """
      When the step counter processes the file
      Then the total step count is 3
      And the step count reflects the template, not the expanded examples

    Scenario: Count steps within Rule blocks
      Given a feature file with content:
        """
        Feature: Rules Feature
          Rule: Authentication
            Scenario: Login
              Given credentials
              When I submit them
              Then I am logged in

          Rule: Authorisation
            Scenario: Access check
              Given I am logged in
              And I have role "admin"
              When I access the resource
              Then access is granted
        """
      When the step counter processes the file
      Then the total step count is 7

    Scenario: Background steps are counted once per feature
      Given a feature file with content:
        """
        Feature: Background Feature
          Background:
            Given a database connection
            And the schema is initialised

          Scenario: Read data
            When I query the database
            Then results are returned

          Scenario: Write data
            When I insert a record
            Then the record exists
        """
      When the step counter processes the file
      Then the total step count is 6
      And the background steps count as 2 (not multiplied by scenarios)

    Scenario: Steps with docstrings count as one step each
      Given a feature file with content:
        """
        Feature: Docstring Feature
          Scenario: Upload content
            Given the API is running
            When I upload with body:
              \"\"\"
              {"key": "value"}
              \"\"\"
            Then the response status is 200
        """
      When the step counter processes the file
      Then the total step count is 3

    Scenario: Steps with data tables count as one step each
      Given a feature file with content:
        """
        Feature: Table Feature
          Scenario: Tabular data
            Given these users exist:
              | name  | role  |
              | Alice | admin |
              | Bob   | user  |
            When I list users
            Then I see 2 users
        """
      When the step counter processes the file
      Then the total step count is 3

    Scenario: Empty feature file has 0 steps
      Given a feature file with no scenarios
      When the step counter processes the file
      Then the total step count is 0
