# Truth Timeline: Conceptual Foundation

## Overview

Truth Timeline is a community-driven decision visualization system that maps personal and collective realities through binary (yes/no) choices. It creates a navigable multiverse where each individual's votes construct their unique reality path through a shared decision space.

---

## Core Principles

### 1. Personal Reality Construction

**Your votes = Your reality**

- When you vote "yes" on a decision, you travel down the yes branch
- When you vote "no", you travel down the no branch
- **It is impossible to be in both states** - you commit to one path
- Your timeline is the accumulated path of all your yes/no choices

### 2. Multiverse Visualization

**Seeing Other Realities**

- The path **you chose** is **highlighted/vibrant** (your reality)
- Parallel paths **others chose** are **grayed out/dimmed** (their reality, not yours)
- You can *see* the alternate timeline but you're not *in* it
- Someone else's "yes" might be your "no" - you literally live in different timelines

Example:
```
Decision Point: "Should we build the highway?"
├─ YES path (500 votes) ← You voted YES [HIGHLIGHTED FOR YOU]
│  └─ Next decision: "Toll road?"
│
└─ NO path (300 votes) [GRAYED OUT FOR YOU]
   └─ Next decision: "Build rail instead?"
```

### 3. Retroactive Voting

**You can vote on past decisions**

This enables:
- Filling in historical gaps (what would you have chosen?)
- Changing your past choices (rewriting your timeline)
- Defining your stance on historical decisions you weren't present for

### 4. Timeline Invalidation & Path Redundancy

**Changing upstream votes can invalidate downstream decisions**

When you change a past vote, all decisions that depended on that choice become invalidated...

**UNLESS** there exists an alternate path to reach them.

Example:
```
        [Do we value freedom?]
              /        \
            YES         NO
            /             \
    [Implement democracy?] [Authoritarianism?]
         /      \              |
       YES      NO            YES
        |        |             |
        +--------+-------------+
                 |
        [Should we have elections?]
```

If you change "Do we value freedom?" from YES to NO:
- Your "Implement democracy?" vote gets invalidated
- **BUT** you can still reach "Should we have elections?" via NO→Authoritarianism→YES
- The question remains in your timeline because **path redundancy** preserved it

**Graph Property**: This is a Directed Acyclic Graph (DAG) where:
- **Multiple paths** to same conclusion = robust (changing upstream doesn't orphan downstream)
- **Single path** to a conclusion = fragile (changing upstream breaks it)
- **Reachability** determines your valid timeline

---

## The Bootstrap Problem

### First User Paradox

The first user faces the **ontological bootstrap problem**:

To answer "I think therefore I am" requires:
- Defining "I"
- Defining "think"
- Defining "therefore"
- Defining "am"

Each definition may require defining more foundational terms, creating a recursive dependency chain.

**The first user must**:
1. Define foundational/atomic terms through yes/no questions
2. Build up to compound questions
3. Create the ontological substrate everyone else inherits

Example term definition for "I":
```
"Is I = consciousness?" YES/NO
"Is I = physical body?" YES/NO
"Is I = continuous identity over time?" YES/NO
```

### Later Users: Inheritance vs. Creation

New users choose their entry point:

**Option 1: Inherit Existing Questions**
- Accept how previous users defined reality
- Faster onboarding
- Start voting on established questions
- Tradeoff: You're accepting others' axioms

**Option 2: Start from Ground Floor**
- Define your own terms from scratch
- Complete philosophical autonomy
- Must define "I", "think", "am", etc. yourself
- Tradeoff: Significant upfront work

### The First Question

For absolute first users, the system begins with fundamental ontological questions:
- "I think therefore I am" (or even more fundamental)
- Requires defining all constituent terms
- Creates the base layer of the collective epistemological graph

---

## Projects: The Gray Area

### When Yes/No Isn't Enough

**Projects** exist for questions that cannot be reduced to binary choices.

When something is too complex for yes/no:
1. A **project** is created
2. The community collaborates in that project space
3. The project works out the complexity
4. Eventually produces yes/no decisions that feed back into the timeline

Projects are collaborative spaces for wrestling with nuance before committing to a path.

---

## 3D Bubble Visualization

### Visual Representation

Each decision = a bubble in 3D space

**Bubble Properties:**
- **Size**: Grows based on community engagement (total votes)
- **Color/Opacity**: Indicates your relationship to it
  - Vibrant: Your chosen path
  - Grayed: Alternate path you didn't take
- **Position**: Temporal and relational connections in 3D space
- **Connections**: Lines showing decision tree structure

**Navigation:**
- Fly through 3D space to explore decision paths
- Follow branches to see alternate realities
- Zoom in/out to see individual decisions or macro patterns
- See where communities cluster (large bubbles)

---

## Historical Truth & Future Integration

### Actual History

Timelines show **actual decisions made** by the community:
- Not hypothetical futures
- Real votes creating real diverging paths
- Personal timelines through collective decision space

### Future Feature: Real-World Data Import

Import historical societal decisions:
- Example: "Society voted 'yes' on internet regulation in 2023"
- Creates historical decision nodes showing what actually happened
- Users can vote their personal stance
- See what their alternate reality would have been
- Compare personal timeline to actual historical events

**Use Cases:**
- Educational: See decision points in history
- Philosophical: "What if" exploration
- Political: Track societal choices over time
- Personal: Understand your values against historical context

---

## Data Structure

### Graph Architecture

**Type**: Directed Acyclic Graph (DAG)

**Nodes**: Decision points (questions)
**Edges**: Yes/No paths
**Properties**:
- Each node has exactly 2 outgoing edges (yes, no)
- Multiple nodes can point to same child (path convergence)
- No cycles (time moves forward)
- Each user has a unique path through the graph

**User Timeline**:
- Subset of graph nodes
- Determined by reachability from user's votes
- Dynamically recalculated when past votes change

---

## Community Dynamics

### Voting Mechanics

- Each decision bubble can be voted on by the community
- Vote = yes OR no (mutually exclusive)
- Bubble size indicates total engagement
- Personal timeline determined by YOUR votes
- Others' votes don't affect your path (but you can see their divergence)

### Collective Intelligence

Communities naturally form around decision paths:
- People who chose similar paths cluster
- Can see where consensus/divergence happens
- Large bubbles = high-engagement decisions
- Patterns emerge showing popular vs. unpopular paths

---

## Philosophical Implications

This system is essentially building a **collective epistemological graph** where:

1. **Communities construct reality from axioms**
2. **Individual agency creates personal truth**
3. **Shared decision space enables comparison**
4. **Historical record shows path dependencies**
5. **Multiverse is navigable and visual**

It's a tool for:
- Understanding how beliefs build on each other
- Exploring alternate realities
- Seeing where you diverge from others
- Mapping the space of possible positions
- Creating a living record of collective reasoning

---

## Summary

**What it is**: A 3D visualization system where communities make yes/no decisions that create branching timelines, with each individual inhabiting their own reality path while seeing others' parallel universes.

**What makes it unique**:
- Personal reality construction through voting
- Retroactive voting with path invalidation
- Visual multiverse navigation
- Ontological bootstrapping from first principles
- Projects for complexity that transcends binary choice
- Historical truth meets personal stance

**The Vision**: Map the decision space of human thought, making visible the branching realities we create through our choices, starting from the most fundamental questions of existence.
