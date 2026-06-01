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
- `createNode(proposition, originUtteranceId, state='UNKNOWN', weight=1) → nodeId`
- `ground(nodeId, utteranceId, weight=1)` — +weight strength (accretion).
- `setState(nodeId, to, utteranceId|null)` — truth moves, APPENDED.
- `assert(text, proposition, state, speaker, weight=1)` — utter + createNode.
- `restate(nodeId, text, speaker, weight=1)` — utter + ground (everyday motion).
- `nodes() → NodeView[]` — FOLD the event log into current views.
- `recall(query) → RecallHit[]` — nodes matching proposition, each with the
  rope (originating utterances) walked DOWN, sorted by strength.

# Strength is WEIGHTED (decision, this session)

Strength = **SUM of the weights** of every distinct grounding utterance, not
a flat count. Each `created`/`grounded` event carries a `weight` (default
1.0). With all weights 1.0, strength == distinct-utterance count (backward
compatible — that's why no event-log migration was needed; the slot was
added before there was data). Proven in replay: a node reads strength 2.3
(1.0 origin + 1.0 restate + 0.3 low-conviction echo).

**The FORMULA that sets weight is a deferred UNKNOWN** (a first-class open
question, like resolution + symbiosis). Candidates: speaker weight (who said
it × relatedness — the symbiosis axis), conviction weight (how firmly + how
independent the paraphrase — the accretion axis), or both multiplied.
Founder chose "store the weight, defer the formula" — body before formula.
This came from the OLD Truth-timeline- repo's "Design node weights" PR: the
founder's past self already wanted weighted truth; this captures the instinct
with discipline under it. See [[core_the_law]].

# Invariants (do not break)

1. **Events are the source of truth.** NodeView is always derived by folding,
   never stored. Strength = SUM of DISTINCT grounding utterances' weights.
2. **Append-only.** No event is edited or deleted. State changes append; the
   prior state stays recoverable. The rope is never cut.
3. **Distinct-utterance counting.** Re-grounding the same utterance does NOT
   raise strength (duplicate ≠ convergent grounding), regardless of weight.
4. **Domain-blind.** No engine file contains a domain word. Domain lives only
   in callers/seed data. (Inherited Heron no-hardcode discipline.)
5. **Store is a seam.** Engine never imports a DB client. New stores
   implement `Store`; engine code does not change.

# Resolution is a HYBRID with a SHRINKING frontier (this session)

The working model: a CONVERSATION in → a TRUTH-GRAPH out. `transfer(turns,
store, resolver, learner?)` runs ordered utterances through a `Resolver`.

`Resolver` is a SEAM (like the store). `HybridResolver` chains:
1. **DeterministicResolver** — cheap/certain: learned patterns + token-overlap
   near-duplicate. Returns `null` (PASSES) on ambiguity — never guesses a merge.
2. **LlmResolver** — the FRONTIER. Called only for what determinism passed.
   Takes an injected `judge` (Claude via connector in prod; a batched
   extraction pass for the transfer test). MUST check `ctx.nodes` and
   `ground` an existing proposition rather than mint a duplicate.

A `Resolution` is `ground` (existing node +strength) | `new` (novel
proposition + T/F/UNKNOWN) | `skip` (not decidable; utterance still recorded).

**The dogfooding curve (founder's insight, now PROVEN):** every LLM
resolution is `learn()`ed into the deterministic resolver, keyed on the
PROPOSITION TEXT (stable) not the node id (ephemeral/per-store), and
re-resolved to the live node by proposition. So the LLM is needed LESS over
time. Measured on the transfer test: pass 1 = 15 LLM decisions, pass 2 = 11
(27% shrink). `npx tsx scripts/transfer-this-conversation.ts`.

**Two real bugs the transfer test caught** (recorded so they aren't re-made):
- judge ignored `ctx.nodes` → made duplicate nodes for restatements. Fix:
  judge checks the map first, grounds if the proposition exists.
- learning keyed on node id → died across stores (fresh MemoryStore per run).
  Fix: learn the proposition, re-resolve to the live node.
The harness FAILED first (0% shrink, 15 nodes with dupes), then passed
(27% shrink, 11 nodes). Build the harness; let it fail honestly first.

# What's intentionally NOT here yet

- Node↔node edges (derivation links, "this truth from that one"). The event
  log can carry them later; not modeled until needed.
- Auto-resolution (similarity merge). Manual for now.
- Persistence / sync. MemoryStore only.
- Per-person scoping (one map for now; symbiosis later — design will add a
  person/owner dimension to utterances + nodes when that inch comes).

Related: [[project_build_order]] · [[core_the_law]]
