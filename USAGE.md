# Getting Started with Truth Timeline

**Quick start guide to building your personal reality timeline.**

---

## Installation

### Prerequisites
- Python 3.7+
- SQLite3 (usually included with Python)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd Truth-timeline-

# No dependencies needed! Uses Python standard library
```

---

## Running the CLI

### Start Interactive Mode

```bash
python3 src/cli.py
```

Or with a specific user ID:

```bash
python3 src/cli.py alice
```

### First Time User

If you're the **first user** (database is empty), you'll be prompted to start the bootstrap flow:

```
🌟 You are the first user!
Start with bootstrap flow? (y/n):
```

This guides you through defining foundational terms like "I" before you can ask complex questions.

---

## Basic Workflow

### 1. Define Terms

Before asking "I think therefore I am", you need to define the terms:

```
Options:
  [1] Define a term
  ...

Choice: 1
Term to define: I
```

The system will:
1. Search your personal definitions
2. Search community definitions
3. Offer AI-generated suggestions
4. Let you create custom definitions

### 2. AI Suggestions

When defining a term, you'll see AI-generated suggestions:

```
🤖 AI Suggestions for defining 'I':
  [1] Is I = individual consciousness?
  [2] Is I = the physical body?
  [3] Is I = continuous identity over time?
  [c] Write custom question

Choice: 1
```

### 3. Vote on Definitions

After selecting or creating a question, you vote:

```
Your vote (yes/no): yes
```

**Your vote determines your reality path!**
- Vote **YES** = you travel down the yes branch
- Vote **NO** = you travel down the no branch
- You can't be in both states simultaneously

### 4. View Your Timeline

See all decisions you've voted YES on:

```
Options:
  ...
  [3] View my timeline

🌟 Your Timeline (5 decisions)

  • Is I = individual consciousness?
    Defines: I
  • Is consciousness = subjective experience?
    Defines: consciousness
  ...
```

### 5. Search Definitions

Look up how terms are defined:

```
Options:
  ...
  [4] Search definitions

Search for term: freedom
```

---

## Understanding the System

### Personal vs. Community Definitions

**Personal Scope** (`personal:alice`)
- Your own definitions
- Only visible to you
- Used for your personal timeline

**Community Scope** (`community:xyz`)
- Shared definitions
- Multiple users can vote
- Inherit or create your own

### The Bootstrap Problem

The first user faces a unique challenge:

To ask: **"I think therefore I am"**

You must first define:
- `I`
- `think`
- `therefore`
- `am`

Each definition might require defining more terms, creating a dependency chain.

**Example flow:**
```
Define "I" → requires "consciousness"
Define "consciousness" → requires "awareness"
Define "awareness" → requires "experience"
...
```

This is why the first user starts at the "ground floor" of ontology.

### Timeline Invalidation

If you **change a past vote**, downstream decisions may become invalidated.

**Example:**
```
[Do we value freedom?] ← You voted YES
        |
[Implement democracy?] ← You voted YES
        |
[Hold elections?] ← You voted YES
```

If you change your vote on "Do we value freedom?" from YES to NO:
- "Implement democracy?" becomes orphaned (unreachable)
- "Hold elections?" also becomes orphaned
- **UNLESS** an alternate path exists to reach them

The system detects orphaned nodes and warns you:

```
⚠️  Warning: 2 orphaned node(s) detected!
These nodes are no longer reachable due to changed votes.
```

### Path Redundancy

Multiple paths to the same decision = **robust timeline**

```
        [Value freedom?]
          /         \
        YES          NO
         |            |
    [Democracy?] [Authoritarianism?]
         |            |
        YES          YES
         \            /
          \          /
           [Hold elections?]
```

Even if you change "Value freedom?", you can still reach "Hold elections?" via the alternate path.

---

## Example Session

### First User Bootstrap

```bash
$ python3 src/cli.py alice

🌟 You are the first user!
Start with bootstrap flow? (y/n): y

Welcome, First User!
You are starting from the ground floor.
To ask 'I think therefore I am', we must first define:
  • I
  • think
  • therefore
  • am

Let's begin with the most fundamental: 'I'

🔍 Searching for definitions of 'I'...

❌ No definitions found for 'I'

We need to create one.

🤖 AI Suggestions for defining 'I':
  [1] Is I = individual consciousness?
  [2] Is I = the physical body?
  [3] Is I = continuous identity over time?
  [c] Write custom question

Choice: 1

✓ Created node: 550e8400-e29b-41d4-a716-446655440000

============================================================
Question: Is I = individual consciousness?
ID: 550e8400-e29b-41d4-a716-446655440000
Defines: I
Votes: 0 yes, 0 no
Your vote: (not voted)
============================================================

Your vote (yes/no): yes
✓ Voted YES

Your reality: I = individual consciousness

Next undefined term: "consciousness"
...
```

### Later User (Inheriting Definitions)

```bash
$ python3 src/cli.py bob

Options:
  [1] Define a term
  ...

Choice: 1
Term to define: I

🔍 Searching for definitions of 'I'...

📚 Found 1 community definition(s):

[1] Is I = individual consciousness?

Options:
  [1] Vote on community definition
  [c] Create custom definition
  [s] Skip for now

Choice: 1

Your vote (yes/no): yes
✓ Voted YES
```

Bob inherits Alice's definition and agrees with it. Now they share that piece of their reality.

If Bob votes **NO**, he creates a divergent reality path and will need to define "I" differently.

---

## Database Location

All data is stored in:

```
data/timeline.db
```

This is a single SQLite file containing:
- All nodes (questions/definitions)
- All votes
- Indexes for fast search

**Backup**: Just copy `data/timeline.db` to back up your entire timeline.

---

## Tips for Building Your Timeline

### Start Simple

Don't try to define everything at once. Start with:
1. One foundational term (e.g., "I")
2. Define only what you need
3. Build up gradually

### Use AI Suggestions

The AI provides philosophical starting points:
- Common definitions
- Different perspectives
- Well-formed yes/no questions

### Vote Honestly

Your timeline represents **your reality**. Vote based on what you actually believe, not what you think you "should" believe.

### Explore Divergence

When you vote differently from the community, you create a unique path. This is a feature, not a bug!

### Check for Orphans

Periodically view your timeline and check for orphaned nodes. This helps you maintain a coherent worldview.

---

## Understanding Bubble Size (Future Feature)

In the 3D visualization (not yet implemented):

**Bubble size** = community engagement
- More votes = bigger bubble
- Indicates important/contested decisions
- Your path is highlighted
- Other paths are grayed out

You'll be able to:
- Navigate 3D space
- See where your reality diverges from others
- Explore alternate timelines
- Find communities of like-minded voters

---

## Troubleshooting

### "Term not defined" warning

```
⚠️  Warning: Undefined terms detected: consciousness, think
You should define these terms first for a complete timeline.
```

**Solution**: Define those terms before asking the question, or continue anyway if you don't care about completeness.

### Database locked

If multiple users try to write simultaneously:

```
sqlite3.OperationalError: database is locked
```

**Solution**: SQLite uses a single writer lock. For concurrent users, migrate to PostgreSQL (same schema, zero code changes).

### Orphaned nodes

```
⚠️  Warning: 3 orphaned node(s) detected!
```

**Solution**: Either:
1. Change your vote back
2. Create a new path to reach those nodes
3. Accept that those decisions are no longer part of your reality

---

## Advanced: Direct Database Access

You can query the database directly using SQLite:

```bash
sqlite3 data/timeline.db
```

### Useful Queries

**See all your yes votes:**
```sql
SELECT n.question, v.vote
FROM nodes n
JOIN votes v ON n.id = v.node_id
WHERE v.user_id = 'alice' AND v.vote = 'yes';
```

**Find all definitions of a term:**
```sql
SELECT question, defining_terms
FROM nodes
WHERE defining_terms LIKE '%"I"%';
```

**Get vote counts for all nodes:**
```sql
SELECT n.question,
       COUNT(CASE WHEN v.vote = 'yes' THEN 1 END) as yes_votes,
       COUNT(CASE WHEN v.vote = 'no' THEN 1 END) as no_votes
FROM nodes n
LEFT JOIN votes v ON n.id = v.node_id
GROUP BY n.id;
```

---

## Next Steps

1. **Define foundational terms** (I, consciousness, reality, truth)
2. **Build your timeline** by voting on yes/no questions
3. **Explore community definitions** (inherit or diverge)
4. **Check for orphans** when changing past votes
5. **Watch your reality take shape**

**Future features:**
- 3D bubble visualization
- Real-world historical data import
- LLM-powered AI suggestions
- Project spaces for complex topics
- Multi-user communities
- Web interface

---

## Philosophy

Truth Timeline is more than a tool—it's a mirror for your worldview.

By forcing yes/no choices and tracking dependencies, it reveals:
- What you actually believe (not what you think you believe)
- How your beliefs build on each other
- Where you diverge from others
- What questions matter most to your reality

**Start building. Your timeline awaits.**
