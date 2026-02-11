@wip @v1
Feature: Neo4j Graph Storage
  As the roadmap application
  I want to store all architecture data in Neo4j instead of SQLite
  So that the graph data model is natively represented, traversals are efficient,
  and the system is ready for production-scale autonomous coding workflows

  Neo4j replaces SQLite as the persistence layer. The domain entities, repository
  interfaces, and use cases remain unchanged. Only the infrastructure layer swaps
  out Drizzle/SQLite repositories for Neo4j Cypher-backed repositories. Connection
  credentials are stored securely via environment variables, never in code or config
  files committed to version control.

  # ── Connection & Configuration ──────────────────────────────────────

  Rule: Neo4j connection is configured via environment variables

    Scenario: Connect to Neo4j using environment variables
      Given the environment variable "NEO4J_URI" is set to "bolt://localhost:7687"
      And the environment variable "NEO4J_USER" is set to "neo4j"
      And the environment variable "NEO4J_PASSWORD" is set to a secure value
      When the application creates a Neo4j connection
      Then the connection is established successfully
      And the driver verifies connectivity with a test query

    Scenario: Connection fails gracefully when NEO4J_URI is missing
      Given the environment variable "NEO4J_URI" is not set
      When the application attempts to create a Neo4j connection
      Then a configuration error is thrown with message containing "NEO4J_URI"
      And no connection is established

    Scenario: Connection fails gracefully when NEO4J_PASSWORD is missing
      Given the environment variable "NEO4J_URI" is set to "bolt://localhost:7687"
      And the environment variable "NEO4J_PASSWORD" is not set
      When the application attempts to create a Neo4j connection
      Then a configuration error is thrown with message containing "NEO4J_PASSWORD"

    Scenario: Connection uses encrypted transport in production
      Given the environment variable "NODE_ENV" is set to "production"
      And the environment variable "NEO4J_URI" starts with "neo4j+s://"
      When the application creates a Neo4j connection
      Then the driver uses encrypted transport
      And the TLS certificate is verified

    Scenario: Connection pool settings are configurable
      Given the environment variable "NEO4J_MAX_CONNECTIONS" is set to "50"
      And the environment variable "NEO4J_ACQUISITION_TIMEOUT" is set to "30000"
      When the application creates a Neo4j connection
      Then the connection pool max size is 50
      And the acquisition timeout is 30000 milliseconds

    Scenario: Connection retries on transient failure
      Given the Neo4j server is temporarily unavailable
      When the application creates a Neo4j connection with retry enabled
      Then it retries the connection up to 3 times
      And it waits with exponential backoff between attempts
      And the final failure is logged with connection details (excluding password)

    Scenario: Credentials are never logged or exposed
      Given a Neo4j connection is configured
      When the connection details are logged
      Then the log output contains the URI
      And the log output does not contain the password
      And the log output does not contain the username

  # ── Schema Initialisation ───────────────────────────────────────────

  Rule: Neo4j schema is initialised with constraints and indexes

    Scenario: Node uniqueness constraint is created
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then a uniqueness constraint exists on Node.id
      And the constraint name is "unique_node_id"

    Scenario: Edge composite uniqueness constraint is created
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then a uniqueness constraint exists on Edge (source_id, target_id, type)
      And duplicate edges are rejected by the database

    Scenario: Version composite uniqueness constraint is created
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then a uniqueness constraint exists on Version (node_id, version)
      And duplicate versions are rejected by the database

    Scenario: Indexes are created for common query patterns
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then an index exists on Node.type
      And an index exists on Node.layer
      And an index exists on Version.node_id
      And an index exists on Feature.node_id
      And an index exists on Feature.version

    Scenario: Schema initialisation is idempotent
      Given a Neo4j database with existing constraints and indexes
      When the schema initialisation runs again
      Then no errors are thrown
      And the constraints remain unchanged
      And the indexes remain unchanged

    Scenario: Full-text index on Node name and description
      Given a fresh Neo4j database
      When the schema initialisation runs
      Then a full-text index exists on Node.name and Node.description
      And the index supports case-insensitive search

  # ── Node CRUD ───────────────────────────────────────────────────────

  Rule: Neo4j node repository implements INodeRepository

    Scenario: Save a new node
      Given an empty Neo4j database with schema
      When I save a node with id "test-comp", name "Test Component", type "component"
      Then a Neo4j node labelled "ArchNode" exists with id "test-comp"
      And the node has property "name" with value "Test Component"
      And the node has property "type" with value "component"

    Scenario: Save a node with all optional fields
      Given an empty Neo4j database with schema
      When I save a node with:
        | field           | value                     |
        | id              | full-comp                 |
        | name            | Full Component            |
        | type            | component                 |
        | layer           | supervisor-layer          |
        | color           | #FF5733                   |
        | icon            | server                    |
        | description     | A fully specified node    |
        | tags            | ["runtime","core"]        |
        | sort_order      | 10                        |
        | current_version | 0.5.0                     |
      Then the Neo4j node "full-comp" has all specified properties

    Scenario: Update an existing node via upsert
      Given a node "upsert-comp" exists in Neo4j with name "Original"
      When I save a node with id "upsert-comp" and name "Updated"
      Then the Neo4j node "upsert-comp" has property "name" with value "Updated"
      And only one node with id "upsert-comp" exists

    Scenario: Find all nodes ordered by sort_order
      Given these nodes exist in Neo4j:
        | id   | name   | type      | sort_order |
        | b    | Beta   | component | 20         |
        | a    | Alpha  | component | 10         |
        | c    | Gamma  | component | 30         |
      When I call findAll on the node repository
      Then the result contains 3 nodes
      And the nodes are ordered ["a", "b", "c"]

    Scenario: Find node by ID
      Given a node "find-me" exists in Neo4j
      When I call findById with "find-me"
      Then the result is the node with id "find-me"

    Scenario: Find node by ID returns null when not found
      When I call findById with "nonexistent"
      Then the result is null

    Scenario: Find nodes by type
      Given these nodes exist in Neo4j:
        | id      | name      | type      |
        | layer-1 | Layer One | layer     |
        | comp-1  | Comp One  | component |
        | comp-2  | Comp Two  | component |
      When I call findByType with "component"
      Then the result contains 2 nodes
      And both nodes have type "component"

    Scenario: Find nodes by layer
      Given these nodes exist in Neo4j:
        | id     | name     | type      | layer    |
        | comp-a | Comp A   | component | layer-x  |
        | comp-b | Comp B   | component | layer-x  |
        | comp-c | Comp C   | component | layer-y  |
      When I call findByLayer with "layer-x"
      Then the result contains 2 nodes
      And both nodes have layer "layer-x"

    Scenario: Check node existence
      Given a node "exists-comp" exists in Neo4j
      When I call exists with "exists-comp"
      Then the result is true

    Scenario: Check node existence returns false for missing
      When I call exists with "missing-comp"
      Then the result is false

    Scenario: Delete a node
      Given a node "delete-me" exists in Neo4j
      When I call delete with "delete-me"
      Then no node with id "delete-me" exists in Neo4j

    Scenario: Delete cascades to related edges
      Given a node "cascade-node" exists in Neo4j
      And an edge exists from "cascade-node" to "other-node" with type "DEPENDS_ON"
      When I call delete with "cascade-node"
      Then no edges reference "cascade-node"

    Scenario: Tags are stored as a JSON string property
      Given I save a node with id "tag-node" and tags ["alpha", "beta"]
      When I call findById with "tag-node"
      Then the node tags are ["alpha", "beta"]
      And the raw Neo4j property "tags" is a JSON string

  # ── Edge CRUD ───────────────────────────────────────────────────────

  Rule: Neo4j edge repository implements IEdgeRepository

    Scenario: Save a new edge as a Neo4j relationship
      Given nodes "source-1" and "target-1" exist in Neo4j
      When I save an edge from "source-1" to "target-1" with type "DEPENDS_ON"
      Then a Neo4j relationship of type "DEPENDS_ON" exists from "source-1" to "target-1"

    Scenario: Save an edge with label and metadata
      Given nodes "src" and "tgt" exist in Neo4j
      When I save an edge from "src" to "tgt" with:
        | field    | value                 |
        | type     | CONTROLS              |
        | label    | spawns                |
        | metadata | {"priority":"high"}   |
      Then the relationship has property "label" with value "spawns"
      And the relationship has property "metadata" with value '{"priority":"high"}'

    Scenario: Edge upsert updates label and metadata
      Given an edge from "a" to "b" with type "DEPENDS_ON" and label "old"
      When I save an edge from "a" to "b" with type "DEPENDS_ON" and label "new"
      Then only one "DEPENDS_ON" relationship exists from "a" to "b"
      And the label is "new"

    Scenario: Find all edges
      Given 5 edges exist in Neo4j
      When I call findAll on the edge repository
      Then the result contains 5 edges

    Scenario: Find edges by source
      Given edges from "hub" to "spoke-1", "spoke-2", "spoke-3" exist
      When I call findBySource with "hub"
      Then the result contains 3 edges
      And all edges have source_id "hub"

    Scenario: Find edges by target
      Given edges from "a" to "hub" and "b" to "hub" exist
      When I call findByTarget with "hub"
      Then the result contains 2 edges
      And all edges have target_id "hub"

    Scenario: Find edges by type
      Given 2 "CONTAINS" and 3 "DEPENDS_ON" edges exist
      When I call findByType with "CONTAINS"
      Then the result contains 2 edges

    Scenario: Find relationships excludes CONTAINS edges
      Given 2 "CONTAINS" and 3 "DEPENDS_ON" edges exist
      When I call findRelationships
      Then the result contains 3 edges
      And no edge has type "CONTAINS"

    Scenario: Delete an edge by ID
      Given an edge with known ID exists in Neo4j
      When I call delete with that edge ID
      Then the edge no longer exists

    Scenario: All 11 edge types are supported
      Given nodes "edge-src" and "edge-tgt" exist in Neo4j
      When I save edges with each of these types:
        | type           |
        | CONTAINS       |
        | CONTROLS       |
        | DEPENDS_ON     |
        | READS_FROM     |
        | WRITES_TO      |
        | DISPATCHES_TO  |
        | ESCALATES_TO   |
        | PROXIES        |
        | SANITISES      |
        | GATES          |
        | SEQUENCE       |
      Then 11 relationships exist from "edge-src" to "edge-tgt"

  # ── Version CRUD ────────────────────────────────────────────────────

  Rule: Neo4j version repository implements IVersionRepository

    Scenario: Save a new version
      Given a node "ver-node" exists in Neo4j
      When I save a version for "ver-node" with version "mvp" and progress 50
      Then a Neo4j node labelled "Version" exists with node_id "ver-node" and version "mvp"
      And the version has progress 50

    Scenario: Version upsert updates content and progress
      Given a version "mvp" exists for node "ver-node" with progress 30
      When I save a version for "ver-node" with version "mvp" and progress 70
      Then the version "mvp" for "ver-node" has progress 70
      And only one version "mvp" exists for "ver-node"

    Scenario: Find all versions
      Given versions exist for multiple nodes
      When I call findAll on the version repository
      Then the result contains all versions ordered by node_id and version

    Scenario: Find versions by node
      Given node "multi-ver" has versions "overview", "mvp", "v1", "v2"
      When I call findByNode with "multi-ver"
      Then the result contains 4 versions
      And all versions have node_id "multi-ver"

    Scenario: Find version by node and version tag
      Given node "specific-ver" has version "v1" with content "V1 spec"
      When I call findByNodeAndVersion with "specific-ver" and "v1"
      Then the result has content "V1 spec"

    Scenario: Update progress and status via save
      Given node "prog-node" has version "mvp" with progress 0 and status "planned"
      When I call save with node "prog-node", version "mvp", progress 50, status "in-progress"
      Then the version has progress 50 and status "in-progress"
      And the updated_at timestamp is refreshed

    Scenario: Delete all versions for a node
      Given node "del-ver" has versions "overview", "mvp", "v1"
      When I call deleteByNode with "del-ver"
      Then no versions exist for "del-ver"

  # ── Feature CRUD ────────────────────────────────────────────────────

  Rule: Neo4j feature repository implements IFeatureRepository

    Scenario: Save a new feature
      Given a node "feat-node" exists in Neo4j
      When I save a feature for "feat-node" with filename "mvp-test.feature"
      Then a Neo4j node labelled "Feature" exists linked to "feat-node"
      And the feature has filename "mvp-test.feature"

    Scenario: Find all features
      Given features exist for multiple nodes and versions
      When I call findAll on the feature repository
      Then the result contains all features ordered by node_id, version, filename

    Scenario: Find features by node
      Given node "feat-multi" has 3 feature files
      When I call findByNode with "feat-multi"
      Then the result contains 3 features

    Scenario: Find features by node and version
      Given node "feat-ver" has 2 "mvp" features and 1 "v1" feature
      When I call findByNodeAndVersion with "feat-ver" and "mvp"
      Then the result contains 2 features
      And both features have version "mvp"

    Scenario: Delete all features (re-seed preparation)
      Given features exist across multiple nodes
      When I call deleteAll on the feature repository
      Then no features exist in the database

    Scenario: Delete features by node
      Given node "feat-del" has features and node "feat-keep" has features
      When I call deleteByNode with "feat-del"
      Then no features exist for "feat-del"
      And features still exist for "feat-keep"

  # ── Native Graph Traversals ─────────────────────────────────────────

  Rule: Neo4j enables native graph traversal queries

    Scenario: Multi-hop dependency traversal
      Given this dependency chain exists:
        | source    | target    |
        | comp-a    | comp-b    |
        | comp-b    | comp-c    |
        | comp-c    | comp-d    |
      When I query for all transitive dependencies of "comp-a" up to depth 3
      Then the result contains "comp-b", "comp-c", "comp-d"

    Scenario: Reverse dependency traversal (dependents)
      Given this dependency chain exists:
        | source    | target    |
        | comp-a    | comp-d    |
        | comp-b    | comp-d    |
        | comp-c    | comp-d    |
      When I query for all transitive dependents of "comp-d" up to depth 1
      Then the result contains "comp-a", "comp-b", "comp-c"

    Scenario: Shortest path between two components
      Given a graph with multiple paths from "start" to "end"
      When I query for the shortest path from "start" to "end"
      Then the result contains the path with the fewest hops
      And each hop includes the edge type and label

    Scenario: Layer containment subtree
      Given a layer "supervisor-layer" containing 4 components
      When I query the containment subtree of "supervisor-layer"
      Then the result contains 4 child nodes
      And each child has a CONTAINS relationship from "supervisor-layer"

    Scenario: Cycle detection in dependency graph
      Given this dependency chain exists:
        | source    | target    |
        | comp-a    | comp-b    |
        | comp-b    | comp-c    |
        | comp-c    | comp-a    |
      When I check for cycles in the dependency graph
      Then a cycle is detected involving "comp-a", "comp-b", "comp-c"

    Scenario: Component neighbourhood query
      Given "center-comp" has 3 outbound and 2 inbound edges
      When I query the 1-hop neighbourhood of "center-comp"
      Then the result contains 5 related components
      And each result includes the edge type and direction

  # ── Data Migration ──────────────────────────────────────────────────

  Rule: SQLite data can be migrated to Neo4j

    Scenario: Migrate all nodes from SQLite to Neo4j
      Given a SQLite database containing 60 nodes
      When the migration tool runs
      Then 60 ArchNode nodes exist in Neo4j
      And each node has all properties preserved

    Scenario: Migrate all edges from SQLite to Neo4j
      Given a SQLite database containing 120 edges
      When the migration tool runs
      Then 120 relationships exist in Neo4j
      And each relationship has the correct type, label, and metadata

    Scenario: Migrate all versions from SQLite to Neo4j
      Given a SQLite database containing 200 versions
      When the migration tool runs
      Then 200 Version nodes exist in Neo4j
      And each version is linked to its parent node

    Scenario: Migrate all features from SQLite to Neo4j
      Given a SQLite database containing 50 features
      When the migration tool runs
      Then 50 Feature nodes exist in Neo4j
      And each feature is linked to its parent node

    Scenario: Migration is idempotent
      Given a SQLite database has been migrated once
      When the migration tool runs again
      Then no duplicate nodes or relationships are created
      And updated properties are reflected in Neo4j

    Scenario: Migration validates data integrity
      Given the migration has completed
      When a validation check compares SQLite and Neo4j
      Then the node count matches
      And the edge count matches
      And the version count matches
      And the feature count matches
      And a sample of 10 nodes have identical properties in both databases

    Scenario: Migration CLI provides progress reporting
      Given a SQLite database with data
      When the migration tool runs in verbose mode
      Then it reports the number of nodes migrated
      And it reports the number of edges migrated
      And it reports the number of versions migrated
      And it reports the number of features migrated
      And it reports the total elapsed time

  # ── Transaction Safety ──────────────────────────────────────────────

  Rule: Neo4j operations use transactions for data integrity

    Scenario: Node save runs within a transaction
      Given the Neo4j node repository
      When I save a node and the operation succeeds
      Then the node is committed to the database

    Scenario: Failed save rolls back the transaction
      Given the Neo4j node repository
      When I save a node with an invalid property
      Then the transaction is rolled back
      And no partial data exists in the database

    Scenario: Bulk insert uses a single transaction
      Given 10 nodes to insert
      When I save all 10 nodes in a batch operation
      Then either all 10 nodes are committed or none are
      And the operation uses a single transaction

    Scenario: Concurrent writes are serialised safely
      Given two concurrent requests to update node "shared-node"
      When both requests execute simultaneously
      Then both writes complete without data corruption
      And the final state reflects one of the two writes

  # ── Security ────────────────────────────────────────────────────────

  Rule: Neo4j connection credentials are handled securely

    Scenario: Password is not stored in any configuration file
      Given the project source directory
      When I search all files for the Neo4j password
      Then no file in the repository contains a hardcoded password
      And credentials are only read from environment variables

    Scenario: Connection string does not leak to client responses
      Given the API server is running with Neo4j backend
      When I send a GET request that causes a database error
      Then the error response does not contain the connection URI
      And the error response does not contain credentials
      And the error response contains a generic error message

    Scenario: Database user has minimum required privileges
      Given the Neo4j user for the application
      Then the user has read and write access to the application database
      And the user does not have admin privileges
      And the user cannot create or drop databases

    Scenario: Environment variables for Neo4j are documented
      Given the project documentation
      Then it lists "NEO4J_URI" as required
      And it lists "NEO4J_USER" as required
      And it lists "NEO4J_PASSWORD" as required
      And it lists "NEO4J_DATABASE" as optional with default "neo4j"
      And it lists "NEO4J_MAX_CONNECTIONS" as optional with default "100"

  # ── Repository Interface Compliance ─────────────────────────────────

  Rule: Neo4j repositories implement the same domain interfaces as SQLite

    Scenario: Neo4j node repository implements INodeRepository
      Given the Neo4j node repository class
      Then it implements the INodeRepository interface
      And it has methods: findAll, findById, findByType, findByLayer, exists, save, delete

    Scenario: Neo4j edge repository implements IEdgeRepository
      Given the Neo4j edge repository class
      Then it implements the IEdgeRepository interface
      And it has methods: findAll, findBySource, findByTarget, findByType, findRelationships, save, delete

    Scenario: Neo4j version repository implements IVersionRepository
      Given the Neo4j version repository class
      Then it implements the IVersionRepository interface
      And it has methods: findAll, findByNode, findByNodeAndVersion, save, deleteByNode

    Scenario: Neo4j feature repository implements IFeatureRepository
      Given the Neo4j feature repository class
      Then it implements the IFeatureRepository interface
      And it has methods: findAll, findByNode, findByNodeAndVersion, save, deleteAll, deleteByNode

    Scenario: Use cases work identically with Neo4j repositories
      Given the GetArchitecture use case
      When I inject Neo4j repositories instead of SQLite repositories
      Then the use case executes without modification
      And the output structure is identical

    Scenario: Adapter wiring selects storage backend from environment
      Given the environment variable "STORAGE_BACKEND" is set to "neo4j"
      When the API adapter initialises
      Then it creates Neo4j repository instances
      And injects them into use cases

    Scenario: Adapter defaults to SQLite when STORAGE_BACKEND is unset
      Given the environment variable "STORAGE_BACKEND" is not set
      When the API adapter initialises
      Then it creates SQLite/Drizzle repository instances
      And injects them into use cases
