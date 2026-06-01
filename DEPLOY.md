# Deploying Orenda (Vercel via GitHub)

Orenda's real landing space is a Vercel deployment (not localhost). Every
push to `main` auto-deploys. One-time setup below.

## 1. Import the repo into Vercel

1. vercel.com → **Add New… → Project** → import `JonBissell89/Truth-timeline-`.
2. **Root Directory: `apps/web`** (important — it's a monorepo).
3. Framework preset: **Next.js** (auto-detected). Leave build/install as default
   — Vercel installs from the repo root so the `@orenda/engine` workspace
   resolves, then builds `apps/web`.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

`.env.local` is gitignored, so Vercel does NOT see it. Add these in the
dashboard (Production + Preview):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the Orenda project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
| `SUPABASE_SECRET_KEY` | secret key (server-only) |
| `NEXT_PUBLIC_APP_URL` | the Vercel URL once known (e.g. https://orenda.vercel.app) |
| `ANTHROPIC_API_KEY` | later — for the talk/agent inch |

(Copy the values from your local `.env.local`. Never commit them.)

## 3. Supabase Auth redirect URLs

Supabase → Orenda project → **Authentication → URL Configuration**:
- **Site URL**: the Vercel URL (https://orenda.vercel.app)
- **Redirect URLs**: add `https://orenda.vercel.app/auth/callback`

Without this the magic-link sign-in won't return correctly.

## 4. The database migration (one-time, before first real use)

The tables must exist in the Orenda Postgres. Either:
- paste `DATABASE_URL` (Supabase → Connect → URI → Session pooler) into
  `.env.local` and run `node scripts/migrate.mjs`, OR
- paste `supabase/migrations/0001_truth_graph.sql` into the Supabase SQL
  Editor and Run.

## Notes

- Local Windows build needs `lightningcss-win32-x64-msvc` and
  `@tailwindcss/oxide-win32-x64-msvc` (npm fails to hoist these native
  Tailwind v4 binaries in a Windows monorepo). Vercel's Linux build installs
  them automatically — these dev-deps are local-only.
