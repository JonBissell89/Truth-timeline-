-- Orenda — the truth graph, in Postgres. The cloud source of truth.
--
-- This is the engine's append-only model (packages/engine) given a real
-- home, plus the two dimensions the cloud service adds: USER (whose map)
-- and PROJECT (which strand of their life). One person, one account, many
-- projects of radically different kinds — code, mountain-bike, cooking,
-- therapist — but ONE consolidator across all of them.
--
-- Invariants carried from the engine (do not break here):
--   * append-only: utterances and node_events are INSERT-only. No row is
--     updated or deleted. Truth-state changes are new events; the rope is
--     never cut.
--   * strength is DERIVED (sum of grounding weights), never stored.
--   * UNKNOWN is first-class.
-- RLS enforces the moat at the data layer: a user can only ever see and
-- write their own map. The publishable key + the user's session is the
-- everyday path; the secret key (server-only) is for migrations/admin.

-- ── PROJECTS ────────────────────────────────────────────────────────────
-- A strand of a person's life. type is free-form on purpose (code,
-- mountain_bike, cooking, therapist, ...) — the substrate is project-type
-- blind, exactly like the engine is domain-blind. The consolidator reads
-- ACROSS a user's projects; a project just scopes where an utterance lands.
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null default 'general',
  created_at  timestamptz not null default now()
);

-- ── UTTERANCES ──────────────────────────────────────────────────────────
-- A raw thing said. The rope end. Immutable. Belongs to a project (and so,
-- transitively, to a user). speaker is 'user' or an agent id.
create table if not exists utterances (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  speaker     text not null default 'user',
  said_at     timestamptz not null default now()
);

-- ── NODE EVENTS ─────────────────────────────────────────────────────────
-- The append-only log. A node's current proposition/state/strength is
-- FOLDED from its events; nothing about a node is stored mutably.
--   kind='created'       -> a proposition is born (origin utterance, state, weight)
--   kind='grounded'      -> another utterance lands on it (+weight)
--   kind='state_changed' -> its truth moves (to-state, witnessing utterance)
-- node_id is a client-or-server-minted uuid grouping the events of one node;
-- it is NOT a row id here (events are the rows). This keeps the table a pure
-- event log.
create table if not exists node_events (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  node_id       uuid not null,
  kind          text not null check (kind in ('created','grounded','state_changed')),
  -- created: proposition + state + weight + origin utterance
  proposition   text,
  state         text check (state in ('TRUE','FALSE','UNKNOWN')),
  weight        numeric,
  utterance_id  uuid references utterances(id) on delete set null,
  -- state_changed: the new state in `state`, witness in `utterance_id`
  at            timestamptz not null default now()
);

create index if not exists utterances_project_idx on utterances(project_id);
create index if not exists node_events_project_idx on node_events(project_id);
create index if not exists node_events_node_idx on node_events(node_id);

-- ── ROW LEVEL SECURITY — the moat at the data layer ──────────────────────
alter table projects   enable row level security;
alter table utterances enable row level security;
alter table node_events enable row level security;

-- A user sees and writes ONLY their own rows. No cross-user read, ever.
-- (Symbiosis — sharing across people — will come later as EXPLICIT,
-- additive policies; the default is strict isolation.)
create policy projects_own on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy utterances_own on utterances
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy node_events_own on node_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Append-only enforcement: revoke UPDATE/DELETE on the two log tables so
-- even a bug (or a compromised session) cannot rewrite history. The rope
-- is never cut — guaranteed by the database, not by convention.
revoke update, delete on utterances from authenticated, anon;
revoke update, delete on node_events from authenticated, anon;
