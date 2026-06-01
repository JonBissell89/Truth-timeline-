---
name: reference_engine_shape
description: "Concrete shape of packages/engine — the files, the API, the invariants — so the next session extends it instead of rebuilding it."
metadata:
  type: reference
---

# packages/engine — the shape

```
src/types.ts   Utterance, TruthState ('TRUE'|'FALSE'|'UNKNOWN'),
               NodeEvent (created|grounded|state_changed) — append-only,
               NodeView (DERIVED: state + strength + groundedBy rope)
src/store.ts   Store interface (addUtterance, appendEvent, allUtterances,
               allEvents — NO update/delete) + MemoryStore impl
src/engine.ts  Orenda class + RecallHit
src/index.ts   public surface
```

# API (Orenda class)

- `utter(text, speaker='user') → Utterance` — a raw thing said enters.
- `createNode(proposition, originUtteranceId, state='UNKNOWN') → nodeId`
- `ground(nodeId, utteranceId)` — +1 strength (accretion).
- `setState(nodeId, to, utteranceId|null)` — truth moves, APPENDED.
- `assert(text, proposition, state, speaker)` — utter + createNode (sugar).
- `restate(nodeId, text, speaker)` — utter + ground (the everyday motion).
- `nodes() → NodeView[]` — FOLD the event log into current views.
- `recall(query) → RecallHit[]` — nodes matching proposition, each with the
  rope (originating utterances) walked DOWN, sorted by strength.

# Invariants (do not break)

1. **Events are the source of truth.** NodeView is always derived by folding,
   never stored. Strength = count of DISTINCT grounding utterances.
2. **Append-only.** No event is edited or deleted. State changes append; the
   prior state stays recoverable. The rope is never cut.
3. **Distinct-utterance counting.** Re-grounding the same utterance does NOT
   raise strength (duplicate ≠ convergent grounding).
4. **Domain-blind.** No engine file contains a domain word. Domain lives only
   in callers/seed data. (Inherited Heron no-hardcode discipline.)
5. **Store is a seam.** Engine never imports a DB client. New stores
   implement `Store`; engine code does not change.

# What's intentionally NOT here yet

- Node↔node edges (derivation links, "this truth from that one"). The event
  log can carry them later; not modeled until needed.
- Auto-resolution (similarity merge). Manual for now.
- Persistence / sync. MemoryStore only.
- Per-person scoping (one map for now; symbiosis later — design will add a
  person/owner dimension to utterances + nodes when that inch comes).

Related: [[project_build_order]] · [[core_the_law]]
