---
name: core_what_is_a_truth_node
description: "Research-grounded definition of a truth node (Toulmin + epistemic KGs + UpSet) and the engine change it demands: separate the shared PROPOSITION from the per-person HOLDING, so maps become overlappable. Read before any node/schema work."
metadata:
  type: project
---

# The end goal that drives the node design (founder, this session)

NOT "a node schema." The goal is **shareable, overlappable truth maps** — a
personal, visual "Wikipedia of truth." Use cases, founder's words:
- share my truth map with a potential girlfriend, see where our truths overlap
- at a company, see truth overlap with all my coworkers
- my habits — cooking, biking — see my truth visually
- as a developer, see my truth by project

Design the node FOR overlap and sharing, not just retrieval. Optimize for
the FETCHER (the agent) first, the reader (human) a close second — "you are
first because you are fetching the data; I am very close to first because I
need to understand the context."

# What a truth node IS (research-grounded)

## Internal structure — Toulmin's model (the canonical argument unit)
A defensible claim has six parts; three are "essential" (claim, ground,
qualifier) and Orenda already has them:
- **Claim** = the proposition (node.proposition) ✅ — MUST be ATOMIC (one
  decidable claim, not a compound sentence; my first 13 nodes were compound
  and wrong — wiped).
- **Ground** = the utterances (the rope) ✅
- **Qualifier** = state (T/F/UNKNOWN) + strength ✅
- **Warrant** = why the grounds support the claim — MISSING, add later.
- **Backing** = credentials for the warrant — MISSING.
- **Rebuttal** = the conditions under which the claim is FALSE — MISSING, and
  this IS the moat's invalidation condition. A claim isn't complete without
  knowing what would falsify it. Structural, not decoration.

## Hierarchy — emerges from support edges, not declared labels
Argumentation theory: the CLAIM of one argument becomes the GROUND of
another. A "principle" is a claim that grounds many sub-claims. So LEVEL is
COMPUTED from position in the support graph (founder's "levels emerge from
edges" instinct — research backs it). Retrieval for the agent = WALK the
support edges, not search a flat list. The hierarchy is the index; the
compression is the retrieval mechanism.

## Overlap — the product, and the hard part (epistemic KGs)
- RDF-star / eSPARQL (2024): never store "X is true." Store "PERSON P holds X
  true, grounded by these utterances." Belief is ATTRIBUTED, never global.
  Two people can hold OPPOSITE states on the SAME proposition — that's not a
  conflict to resolve, it's the overlap DATA.
- **Node identity = the proposition (shared/global). State = per-person
  HOLDING.** This is the load-bearing engine change: SEPARATE the shared
  proposition from the per-person holding. Today's schema fuses them; that's
  why maps can't overlap yet.
- Overlap = set algebra over attributed claims:
  - **agreement** = same proposition, same state → bright shared light
  - **tension** = same proposition, opposite state → the interesting light
    (what a couple/team actually needs to talk about)
  - **gap** = one holds it, other never grounded it → the invitation
- Visualization scales by biomimicry-zoom (founder's existing memory):
  - 2 people (you + girlfriend) → Venn-like overlap of two fields
  - many people (team) → Venn BREAKS DOWN; academic standard is **UpSet
    plots** (set-intersection matrix). Same data, different visual primitive
    at different scale = the zoom-band principle, confirmed by research.

# The engine change this demands (next inch)

Split the substrate:
- **propositions** — shared, global identity (the claim text, atomic). The
  thing two maps can both reference.
- **holdings** — per (person, proposition): their state, their strength,
  their grounding utterances, eventually their warrant + rebuttal.
- **support edges** — proposition grounds proposition (hierarchy emerges).
Then overlap = compare two people's holdings over shared propositions.
RLS still scopes a person to their own holdings; sharing is EXPLICIT, additive
(a person grants overlap-visibility), never default — same discipline as the
moat. The 13 ad-hoc nodes were WIPED to rebuild on this.

# Sources
- Toulmin model (claim/ground/warrant/backing/qualifier/rebuttal) — argumentation theory.
- eSPARQL / RDF-star epistemic knowledge graphs (arXiv 2407.21483) — attributed belief, reconciling conflicting beliefs.
- Epistemic Networks (arXiv 2102.12458) — belief/confidence across a social group.
- UpSet / UpSetR (2017) — set-intersection visualization beyond Venn's 3-set limit.

Related: [[core_the_law]] · [[core_the_ladder]] · [[core_what_orenda_is]] · the founder's biomimicry-zoom memory (visual grammar changes by zoom band).
