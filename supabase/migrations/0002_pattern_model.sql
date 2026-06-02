-- Orenda — the floorless pattern model. THE slide.
--
-- Supersedes the proposition/node_events schema (0001). The earned primitive
-- (packages/engine/src/pattern.ts, 11 breakers green): ONE thing — a pattern.
-- It EXPRESSES a parent (what it's about) and may be AUTHORED by a person
-- (who said it). Fractal both directions. Strength emerges (weighted fold).
--
-- THE LAW: no floor. The schema knows only patterns, the expresses-edge, the
-- author, weight, pull, state. NO preset attractors, NO seeded soil. The
-- floor — if human meaning has one — is DISCOVERED from data, shown to no
-- one until it emerges (showing candidates contaminates the experiment).
--
-- This is also the AGENT's externalized memory: context is never stored, only
-- patterns. Retrieval = climbing the expresses-edge.

-- ── PATTERNS ─────────────────────────────────────────────────────────────
-- The one primitive. A person is a pattern (author = themselves, is_user).
-- A phrase is a pattern authored by a person. A deep shared pattern has no
-- author (ownerless soil). All the same row.
create table if not exists patterns (
  id           uuid primary key default gen_random_uuid(),
  -- what the pattern IS, in words at the moment it was expressed. (Words are
  -- ONE expression layer; the pattern is the structure. Berry and hot-tub
  -- differ in text, same pattern.)
  text         text not null,
  -- the parent this pattern EXPRESSES (what it is about). null = a root: a
  -- user, or a deep pattern not yet beneath anything. Re-parentable when a
  -- parent crystallizes above it (up-growth) — append a new edge; lineage
  -- stays recoverable in history.
  expresses    uuid references patterns(id) on delete set null,
  -- WHO authored this (a user id), or null for ownerless soil. Distinct from
  -- expresses. A phrase is authored-by a person AND expresses a pattern —
  -- that separation is exactly why two people overlap.
  author       uuid references auth.users(id) on delete cascade,
  -- is this pattern a USER root (a person)?
  is_user      boolean not null default false,
  -- significance of THIS expression (one searing moment >> 50 idle repeats).
  -- The formula that sets it is deferred; the slot is proven necessary.
  weight       numeric not null default 1,
  -- salience/pull of an open question (do-I-want-kids >> trivia).
  pull         numeric,
  -- optional truth-state. UNKNOWN is first-class.
  state        text check (state in ('TRUE','FALSE','UNKNOWN')),
  created_at   timestamptz not null default now()
);

create index if not exists patterns_expresses_idx on patterns(expresses);
create index if not exists patterns_author_idx on patterns(author);

-- ── RLS — the moat at the data layer ─────────────────────────────────────
alter table patterns enable row level security;

-- A user sees + writes patterns they authored. Ownerless soil (author null)
-- is readable by all (it is the shared ground where overlap lives) but only
-- writable server-side (the agent crystallizes it). Holdings/phrases stay
-- private to their author.
create policy patterns_author_rw on patterns
  for all
  using (auth.uid() = author)
  with check (auth.uid() = author);

-- shared soil is world-readable (it carries no one's private content — it is
-- the deep pattern text only, e.g. "comfort"). Read-only for users; the
-- agent (secret key) writes it.
create policy patterns_soil_read on patterns
  for select
  using (author is null);

-- Append-discipline: a pattern's text/author/weight never change after
-- creation (the rope). Only `expresses` may be repointed by up-growth, and
-- `state` may move (a state change is conceptually a new expression, but we
-- allow the column to move for now; history lives in created_at ordering of
-- sibling expressions). Revoke DELETE so memory is never destroyed.
revoke delete on patterns from authenticated, anon;
