# Orenda

A visual representation of truth.

You talk — to a Claude agent, on your phone, on your laptop, in your ear on
the trail. Out of the ten million words you say, meaning consolidates. Orenda
is where that meaning becomes **visible**: a living map of propositions, each
resolving **TRUE · FALSE · UNKNOWN**, each growing stronger the more times the
same truth is said a different way.

*Orenda* (Iroquois): the spiritual force a person exerts to change the world.
This map is yours, made of your own words, accreting.

## What it is

- **The agent is the voice** (Claude, conversational, everywhere).
- **Orenda is the body** — the visible residue of the conversation.
- One map per person. It is **yours to see** and the **agent's to traverse**:
  "recall that thing I said about X" walks the map to the node and back down
  the rope to the exact words that grounded it.

## The law (the moat)

The rope is never cut. Every node can be walked back down to the utterances
that made it true. **Unknown is first-class** — it is where conversation
forms, never a missing value. The system can never silently collapse unknown
into true. Truth is not asserted; it **accretes**.

## The ladder

```
thought → speech → memory → definition → meaning → understanding
 (utter)  (ground) (record)  (define)    (derive)  (resolve)
```

A billion conversations consolidate into a hundred thousand fields, a hundred
meanings, ten processes — and you can always walk back down.

## Structure

```
packages/engine   the brain — append-only provenance graph, T/F/UNKNOWN,
                  strength as a COUNT over events, recall(). Domain-blind.
                  Store-agnostic (in-memory today, Postgres/Supabase later).
apps/web          the laptop face (skin — not built yet)
apps/mobile       the trail/voice face (skin — not built yet)
supabase          the synced store (not wired yet)
scripts/replay.ts the first proof: replays the founding conversation so you
                  watch real nodes precipitate and strength tick.
memory/           grounding for the next session that opens Orenda.
```

## Run the proof

```
npm install
npm run replay
```

You will see the first map: TRUE/FALSE/UNKNOWN nodes, strength ticking on
restatement, a node moved from one truth to another with its history intact,
and the rope walked down to origin.

## Build order: body before skin

The substrate ticks first. The **biofabric** render — node-as-row, edge-as-
column, a grid that scales to a million nodes without becoming a hairball —
is the mid/far band of a biomimicry-zoom surface (living lights up close,
fabric at distance). It is a deferred inch, built only once there is real
truth to render.
