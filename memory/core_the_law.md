---
name: core_the_law
description: "The moat / the three forces that make Orenda truth and not a notes app. The rope is never cut; unknown is first-class; truth accretes. Read before any engine or store change."
metadata:
  type: project
---

# The law: the rope is never cut

Every node can be walked back DOWN to the utterances that made it true. The
origination point of every truth is always recoverable. Structurally this is
an **append-only event log**: nodes are never overwritten, truth-state
changes are appended (the previous state stays in the log), strength is a
COUNT over events, never a stored mutable number. A definition you cannot
walk back down to its grounding is "a lie wearing a word's clothes."

This is the same moat as Heron's, restated: **the system can never silently
collapse unknown into true.**

# Every node is a PROPOSITION (founder, this conversation)

A node is not a topic ("Campaign"). It is a STATEMENT that resolves
**TRUE · FALSE · UNKNOWN** ("Campaign links to a database" → T/F). Its job is
to be decidable. Enforced by the `TruthState` type.

**UNKNOWN is first-class.** A node that can't yet resolve T or F IS the
unknown — and "this is where conversations form." The undecided node is the
SEAT of discussion, not a gap, not a missing value, not an error. The two
things the founder deferred (resolution policy, symbiosis policy) are
literally UNKNOWN nodes on Orenda's own map. The roadmap is shaped like the
product.

# The three forces (in tension — this is what makes it a SYSTEM)

| Force | What it does | Loop type |
|---|---|---|
| **Accretion** | repetition (said differently) strengthens a node | reinforcing |
| **Resolution** | deciding two utterances hit the SAME node, by confirmation — never silently | balancing |
| **Symbiosis** | strength flows across RELATED people's maps without merging them | reinforcing |

Accretion *wants* to merge (more strength). Resolution *refuses* to merge
without confirmation (no silent collapse). Symbiosis *spreads* without
merging the maps. The product is the BALANCE of these three.

**"Slightly different" matters:** ten verbatim repeats = one fact echoed. Ten
*paraphrases* hitting the same node = convergent grounding (independent
witnesses agreeing) = far stronger. The variation is the evidence, not noise.
(Engine already counts distinct utterances only, so duplicates don't inflate.)

# Deferred UNKNOWN nodes (do NOT design these prematurely)

- **Resolution policy** — when two slightly-different utterances merge. For
  now: MANUAL pointing (the caller asserts the match). Auto-merge by
  similarity is deferred. Founder: "lets get the strength first then ask."
- **Symbiosis policy** — how one person's strength reaches a coworker's map.
  Deferred until strength exists to dispose. Founder: "lets get it first."
- **Weight formula** — strength is now a SUM of per-grounding WEIGHTS (not a
  flat count); the engine stores the weight, but WHAT sets it is deferred.
  Candidates: speaker × relatedness (symbiosis axis), conviction ×
  independence (accretion axis), or both. From the old Truth-timeline-
  repo's "Design node weights" PR. Founder: "store the weight, defer the
  formula." Today all weights default 1.0. See [[reference_engine_shape]].

All three are downstream of "make strength visible." Don't build the
thermostat before the thermometer ticks.

Related: [[core_what_orenda_is]] · [[core_the_ladder]] · [[reference_engine_shape]]
