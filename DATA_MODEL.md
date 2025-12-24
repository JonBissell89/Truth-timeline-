# Data Model Specification

**Design Goal**: Simplest possible structure that scales to millions of users and nodes with fast search.

**Storage Strategy**: SQLite → PostgreSQL migration path (zero code changes)

---

## Core Schema

### Table: `nodes`

Every decision/question/definition is a node in the graph.

```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,              -- UUID v4
    question TEXT NOT NULL,           -- "Is I = consciousness?"
    defining_terms TEXT,              -- JSON: ["I"] - terms this node defines
    using_terms TEXT,                 -- JSON: ["I", "consciousness"] - all terms used
    parents TEXT,                     -- JSON: [{"id": "abc", "via": "yes"}] - incoming edges
    scope TEXT NOT NULL,              -- "personal:user123" or "community:xyz"
    created_by TEXT NOT NULL,         -- User ID who created this node
    created_at INTEGER NOT NULL       -- Unix timestamp
);

CREATE INDEX idx_nodes_scope ON nodes(scope);
CREATE INDEX idx_nodes_defining ON nodes(defining_terms);
CREATE INDEX idx_nodes_using ON nodes(using_terms);
```

**Field Explanations**:

- **id**: Globally unique identifier (UUID v4)
- **question**: The yes/no question being asked
- **defining_terms**: Array of terms this question defines (usually 1, can be 0 for non-definition questions)
- **using_terms**: All terms used in the question (for dependency tracking)
- **parents**: Array of parent nodes and which path (yes/no) leads to this node
- **scope**:
  - `personal:user123` - User's private definitions
  - `community:uuid` - Shared community definitions
  - `global` - System-wide definitions
- **created_by**: User who created the node
- **created_at**: When node was created

### Table: `votes`

Tracks user votes on nodes (separate for query performance).

```sql
CREATE TABLE votes (
    node_id TEXT NOT NULL,            -- References nodes.id
    user_id TEXT NOT NULL,            -- User who voted
    vote TEXT NOT NULL,               -- "yes" or "no"
    voted_at INTEGER NOT NULL,        -- Unix timestamp
    PRIMARY KEY (node_id, user_id),
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_node ON votes(node_id);
```

**Constraints**:
- One vote per user per node
- Vote must be "yes" or "no"
- Updating a vote updates the record (upsert pattern)

---

## JSON Field Formats

### `defining_terms`
```json
["I"]
["consciousness", "awareness"]
[]
```

### `using_terms`
```json
["I", "consciousness"]
["freedom", "choice", "autonomy"]
```

### `parents`
```json
[
  {"id": "parent-node-uuid-1", "via": "yes"},
  {"id": "parent-node-uuid-2", "via": "no"}
]
```

Empty array `[]` for root nodes (first questions with no parents).

---

## Example Data

### Example 1: Defining "I"

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "question": "Is I = individual consciousness?",
  "defining_terms": ["I"],
  "using_terms": ["I", "individual", "consciousness"],
  "parents": [],
  "scope": "personal:alice",
  "created_by": "alice",
  "created_at": 1703400000
}
```

Vote:
```json
{
  "node_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "alice",
  "vote": "yes",
  "voted_at": 1703400001
}
```

### Example 2: Using "I" to define "consciousness"

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "question": "Is consciousness = subjective experience?",
  "defining_terms": ["consciousness"],
  "using_terms": ["consciousness", "subjective", "experience"],
  "parents": [
    {"id": "550e8400-e29b-41d4-a716-446655440000", "via": "yes"}
  ],
  "scope": "personal:alice",
  "created_by": "alice",
  "created_at": 1703400100
}
```

This node is a child of the "I = consciousness" node via the YES path.

### Example 3: Community Definition

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "question": "Is freedom = ability to choose?",
  "defining_terms": ["freedom"],
  "using_terms": ["freedom", "ability", "choose"],
  "parents": [],
  "scope": "community:philosophy101",
  "created_by": "bob",
  "created_at": 1703500000
}
```

Multiple users can vote on this:
```json
{"node_id": "770e8400...", "user_id": "alice", "vote": "yes", "voted_at": 1703500100}
{"node_id": "770e8400...", "user_id": "bob", "vote": "yes", "voted_at": 1703500101}
{"node_id": "770e8400...", "user_id": "charlie", "vote": "no", "voted_at": 1703500102}
```

---

## Query Patterns

### Search for definitions of a term

```sql
-- Find all personal definitions of "I" for user alice
SELECT * FROM nodes
WHERE defining_terms LIKE '%"I"%'
  AND scope = 'personal:alice';

-- Find all community definitions of "freedom"
SELECT * FROM nodes
WHERE defining_terms LIKE '%"freedom"%'
  AND scope LIKE 'community:%';
```

### Get user's timeline

```sql
-- Get all nodes where alice voted yes
SELECT n.*, v.vote, v.voted_at
FROM nodes n
JOIN votes v ON n.id = v.node_id
WHERE v.user_id = 'alice'
  AND v.vote = 'yes'
ORDER BY v.voted_at;
```

### Find undefined terms in a question

```python
# Extract terms from question
question = "I think therefore I am"
terms = ["I", "think", "therefore", "am"]

# Check each term
for term in terms:
    # Check personal definitions
    result = db.execute(
        "SELECT * FROM nodes WHERE defining_terms LIKE ? AND scope = ?",
        (f'%"{term}"%', f'personal:{user_id}')
    ).fetchone()

    if not result:
        # Not defined personally, check community
        community_results = db.execute(
            "SELECT * FROM nodes WHERE defining_terms LIKE ? AND scope LIKE 'community:%'",
            (f'%"{term}"%',)
        ).fetchall()

        if not community_results:
            # Completely undefined - trigger AI suggestion
            undefined_terms.append(term)
```

### Get children of a node

```sql
-- Find all nodes that have node X as a parent
SELECT * FROM nodes
WHERE parents LIKE '%"id": "X"%';

-- Find all nodes reachable via YES from node X
SELECT * FROM nodes
WHERE parents LIKE '%"id": "X", "via": "yes"%';
```

### Calculate timeline validity after vote change

```python
def recalculate_timeline(user_id, changed_node_id):
    """When user changes a vote, find orphaned downstream nodes."""

    # Get all nodes in user's timeline (voted yes)
    timeline_nodes = get_user_timeline_nodes(user_id)

    # Build reachability graph from root nodes
    reachable = set()
    queue = get_root_nodes(user_id)  # Nodes with no parents

    while queue:
        node = queue.pop(0)
        reachable.add(node.id)

        # Get children where user voted yes
        children = get_children_voted_yes(node.id, user_id)
        queue.extend(children)

    # Orphaned nodes = in timeline but not reachable
    orphaned = timeline_nodes - reachable

    return orphaned
```

---

## Scaling Considerations

### SQLite Limits (Good to ~10M rows)
- **File size**: Grows linearly (~100 bytes per node = 1GB for 10M nodes)
- **Query speed**: Milliseconds with indexes
- **Concurrent writes**: Single writer, but reads are parallel
- **Good for**: MVP, single-server deployments, personal use

### PostgreSQL Migration (10M+ rows)
- **Same schema works** - just change connection string
- **Parallel writes**: Multiple users voting simultaneously
- **Replication**: Read replicas for scaling queries
- **Good for**: Production, multi-server, high concurrency

### Query Optimization
- **JSON search**: `LIKE '%"term"%'` is fast with index, but for 100M+ rows consider:
  - PostgreSQL JSONB with GIN indexes
  - Full-text search (FTS5 in SQLite, TSVector in Postgres)
  - Dedicated search layer (Elasticsearch) for complex queries

### Storage Efficiency
- **Compression**: Enable SQLite page compression for 2-3x reduction
- **Archival**: Move old/inactive nodes to separate table
- **Sharding**: Partition by scope (personal vs community) if needed

---

## Migration Path

### Phase 1: SQLite (Now)
```python
import sqlite3
db = sqlite3.connect('data/timeline.db')
```

### Phase 2: PostgreSQL (When needed)
```python
import psycopg2
db = psycopg2.connect('postgresql://localhost/timeline')
```

**Same schema, same queries, zero code changes.**

### Phase 3: Distributed (100M+ nodes)
- CockroachDB (PostgreSQL compatible)
- YugabyteDB (PostgreSQL compatible)
- Same schema still works

---

## Why This Works at Scale

1. **Normalized votes table** - Fast user timeline queries
2. **Indexed JSON** - Fast term search without complex schema
3. **Simple relationships** - Parent links in JSON, not separate join table
4. **Scope partitioning** - Natural sharding boundary
5. **Append-mostly** - Votes change, but nodes rarely deleted
6. **No complex joins** - Most queries touch 1-2 tables max

**Result**: Millions of nodes, sub-second queries, simple codebase.

---

## Comparison to Alternatives

| Approach | Complexity | Scalability | Query Speed |
|----------|-----------|-------------|-------------|
| **This model** | ⭐ Low | ⭐⭐⭐ High | ⭐⭐⭐ Fast |
| Graph DB (Neo4j) | ⭐⭐⭐ High | ⭐⭐⭐ High | ⭐⭐ Medium |
| Document DB (Mongo) | ⭐⭐ Medium | ⭐⭐⭐ High | ⭐⭐ Medium |
| JSON files | ⭐ Low | ⭐ Low | ⭐ Slow |

**Why not a graph database?**
- Overhead of learning Cypher/Gremlin
- Our queries are simple (find by term, get timeline)
- SQL indexes give us 90% of graph DB performance
- Can always migrate later if needed

**Why not document database?**
- SQL is simpler for term search and user timelines
- Postgres JSONB gives us document flexibility anyway
- Easier to reason about with relational model

---

## Summary

**Two tables. Simple indexes. Scales to millions.**

```
nodes (id, question, defining_terms, using_terms, parents, scope, created_by, created_at)
votes (node_id, user_id, vote, voted_at)
```

That's it. Everything else is application logic.
