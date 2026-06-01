---
name: project_build_order
description: "Body before skin. The build sequence for Orenda and the decisions already locked. Read before picking the next inch."
metadata:
  type: project
---

# Body before skin (founder-confirmed)

Build the substrate that TICKS before rendering anything. The biofabric
render comes only once there is real truth to render. Confirmed by the
founder's own falsification test (biomimicry-zoom): "if a zoom inch just
makes things bigger/smaller with the same grammar, it's wrong" — meaningless
on an empty store.

# Done (inch 1 — the first body)

- `packages/engine` — append-only provenance graph. Utterances, nodes
  (proposition + TRUE/FALSE/UNKNOWN), append-only events, strength as a
  COUNT, `recall()` that walks the rope down. Domain-blind. Store-agnostic.
- `MemoryStore` — in-memory store (no infra). Real and append-only.
- `scripts/replay.ts` — replays the FOUNDING conversation. PROVEN ticking:
  a TRUE node at strength 4 (said 4 ways), 2 first-class UNKNOWN nodes, a
  truth that MOVED (C:/dev → Desktop) with history intact, recall walking
  the rope to origin. `npm run replay`.
- Monorepo: `apps/web`, `apps/mobile` (empty stubs), `packages/engine`,
  `supabase/` (empty), memory home.

# Decisions LOCKED

- **Location:** `C:/Users/jbiss/Desktop/Orenda`. Peer to Heron, never inside.
  Founder: "where we start is where we finish, I dont want to move this."
- **Monorepo from commit one** — because multiple clients (phone, laptop) +
  one shared brain. Engine in `packages/` because it's shared between every
  human face AND the agent's traversal, not "the web app's backend."
- **Store is a SEAM** — engine talks to a `Store` interface, never a DB
  directly. In-memory today; Postgres/Supabase adapter drops in later with
  ZERO engine changes. (That's why hosted Supabase is NOT a blocker now.)
- **Append-only by contract** — `Store` exposes add/append, no update/delete.
- **Resolution = manual** for now (caller asserts a match). Auto-merge by
  similarity deferred. (See [[core_the_law]].)
- **Biofabric = the render decision, DEFERRED.** Founder meant BioFabric-the-
  technique (node=row, edge=column, a grid that scales to millions without a
  hairball) FUSED with biomimicry-zoom (living lights up close, fabric at
  distance). It is the mid/far band. Build only when truth exists to render.

# Next inches (not yet built, order is the founder's call)

1. **The skin (first render)** — a calm dark space-traveler surface that
   renders the live map: nodes as lights, strength as glow/size, T/F/UNKNOWN
   legible, UNKNOWN visibly the seat of conversation. Up-close band first.
2. **The live agent** — talking to the coworker agent (via a connector, NOT a
   hard-coded prompt) deposits nodes automatically. The conversation IS the
   fill. Until this, nodes enter via script/manual.
3. **Real store + sync** — Supabase adapter behind the `Store` seam; phone +
   laptop show the same map.
4. **Voice input** — transcribed speech-while-moving as the utterance source.
5. (later) symbiosis — second person's map, relatedness links, strength flow.

# Open work the founder has NOT decided

- GitHub remote: `gh` is NOT installed on this machine. First commit is
  LOCAL only. To push: install gh OR `git remote add origin <url>` to a repo
  the founder creates, then push. (Do not assume an account/visibility.)

Related: [[core_what_orenda_is]] · [[reference_engine_shape]]
