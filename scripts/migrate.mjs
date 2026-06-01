// Orenda migration runner — applies supabase/migrations/*.sql to the
// Orenda Postgres, in order. Reads connection from .env.local:
//   DATABASE_URL  (preferred — paste from Supabase dashboard), OR
//   constructs the direct connection from project ref + Supabase_PASSWORD.
//
// Targets ORENDA's project only. Never the MCP-configured project (that is
// Heron's). Run: node scripts/migrate.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// minimal .env.local parser (no deps)
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

function connString() {
  if (env.DATABASE_URL && env.DATABASE_URL.trim()) return env.DATABASE_URL.trim()
  const url = env.NEXT_PUBLIC_SUPABASE_URL || ''
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  const pw = env.Supabase_PASSWORD
  if (!ref || !pw) throw new Error('need DATABASE_URL or project ref + Supabase_PASSWORD')
  // direct connection host (stable per project)
  return `postgresql://postgres:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres`
}

async function main() {
  const client = new pg.Client({ connectionString: connString(), ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('connected to Orenda Postgres')
  const dir = join(root, 'supabase', 'migrations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8')
    process.stdout.write(`applying ${f} ... `)
    await client.query(sql)
    console.log('ok')
  }
  await client.end()
  console.log('all migrations applied')
}
main().catch((e) => {
  console.error('MIGRATION FAILED:', e.message)
  process.exit(1)
})
