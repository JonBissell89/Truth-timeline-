---
name: project_deploy
description: "Orenda deploys to Vercel via GitHub (its real landing space — NOT localhost). The cloud architecture, env wiring, and the Windows native-binary gotcha. Read before touching deploy/build."
metadata:
  type: project
---

# Landing space = Vercel, not localhost

Founder: "I don't want to do localhost as this is not the final landing
space." Orenda is a phone+laptop product you log into from anywhere, so it
lives on a real URL from the start. Deploy = **Vercel via GitHub import**,
auto-deploy on push to `main`. Same loop as Heron. Full steps in `DEPLOY.md`.

# Architecture (founder-chosen)

Cloud service + web app. Supabase (Postgres + Auth) is the source of truth;
the web app + (later) phone + (later) VSCode are faces. VSCode is just one
SENSOR for the code project, NOT the home — Orenda stands alone.

# Key discipline (founder-corrected)

- Publishable key → browser/app, runs AS the logged-in user, RLS-enforced.
- Secret key → SERVER ONLY (migrations/admin). Never in client code.
- (The founder explicitly asked to use the publishable/secret scheme, not
  service_role-everywhere. Honor that.)
- The MCP Supabase tools point at HERON's project (pewzwmpuleezpoczepvi),
  NOT Orenda's (feeixujfykcropxmsbla). NEVER run Orenda migrations through
  the MCP tools — they'd land in Heron's DB. Use scripts/migrate.mjs against
  Orenda's DATABASE_URL, or the Orenda SQL editor.

# Env wiring

One root `.env.local` (gitignored) holds all keys; `next.config.ts` loads it
for LOCAL dev only (guarded by existsSync). On Vercel, env vars come from the
dashboard (the file isn't committed). `.env.example` documents the slots.

# The one human-only blocker (recurring)

`DATABASE_URL` (Supabase Session-pooler URI) — needed to run the migration.
The pooler region/username can't be guessed and the direct host
`db.<ref>.supabase.co` no longer resolves for new projects. Must come from
the dashboard (Connect → URI). Alternative: paste 0001 SQL into the SQL
Editor (no DATABASE_URL needed).

# Windows build gotcha (local only)

Tailwind v4 native deps fail to hoist in a Windows npm monorepo. Installed
`lightningcss-win32-x64-msvc` + `@tailwindcss/oxide-win32-x64-msvc` as
dev-deps so the LOCAL `next build` works. Vercel's Linux build installs the
correct binaries automatically — these are local-only, harmless on Vercel.
`apps/web` production build VERIFIED green locally before first deploy.

Related: [[core_what_orenda_is]] · [[reference_engine_shape]]
