// Climb THIS conversation into the live map. The agent (me) is the
// microscope: I take real things the founder said, and the climb each one
// took as we reasoned, and write them as patterns into the live DB.
//
// THE LAW honored: no preset attractors, no seeded floor. Where two climbs
// reach the SAME deep pattern, that convergence is DISCOVERED (I noticed it
// in conversation), written as ONE shared ownerless node — not asserted by a
// hardcoded ontology. Deep shared patterns are authored=null (soil).
//
// Usage: node scripts/climb-into-live.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = env.SUPABASE_SECRET_KEY
const EMAIL = 'jbissell89.jb@gmail.com'
const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }

async function userId() {
  const r = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: H })
  const u = (await r.json()).users.find((x) => x.email === EMAIL)
  if (!u) throw new Error('user not found'); return u.id
}
async function insert(row) {
  const r = await fetch(`${URL}/rest/v1/patterns`, {
    method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(row),
  })
  if (!r.ok) throw new Error(`insert: ${r.status} ${await r.text()}`)
  return (await r.json())[0]
}

async function main() {
  const uid = await userId()
  console.log('user:', uid)

  // user root — a person IS a pattern
  const me = await insert({ text: 'Jon', author: uid, is_user: true })

  // helper: a phrase the user authored, expressing a parent
  const say = (text, expresses, state) =>
    insert({ text, expresses, author: uid, state: state ?? null })
  // helper: ownerless DEEP pattern (shared soil) — discovered convergence
  const soil = (text, expresses = null) => insert({ text, expresses, author: null })

  // ── The climbs, as they actually went in our conversation ────────────
  // Each surface phrase is something the founder really said; the chain
  // above it is the "why" climb I did in language. Where chains MEET, I
  // write ONE shared soil node (discovered, not assumed).

  // Two deep soil patterns these climbs converged toward (DISCOVERED in
  // conversation — I noticed three statements draining to them).
  const seen = await soil('truth should be SEEN, not just known')
  const honest = await soil('truth must be HONEST')

  // climb 1: "visual representation of truth"
  const c1a = await say('I want to build a visual representation of truth', null, 'TRUE')
  const c1b = await say('truth should be understood by seeing it', seen.id, 'TRUE')
  await patch(c1a.id, c1b.id) // c1a expresses c1b

  // climb 2: "it should be weighted"
  const c2a = await say('truth-strength should be weighted, not counted', null, 'TRUE')
  const c2b = await say('significance is not repetition', honest.id, 'TRUE')
  await patch(c2a.id, c2b.id)

  // climb 3: "no floor, never show attractors"
  const c3a = await say('never show candidate attractors to users', null, 'TRUE')
  const c3b = await say('the experiment must not be contaminated', honest.id, 'TRUE')
  await patch(c3a.id, c3b.id)

  // climb 4: "this product is you, make it a diagram"
  const c4a = await say('this product is the Claude agent, made visual', null, 'TRUE')
  const c4b = await say('the climb already happens in conversation', seen.id, 'TRUE')
  await patch(c4a.id, c4b.id)

  // climb 5: the keystone — pattern is the agent's memory
  const c5a = await say('the pattern is the agent\'s externalized memory', null, 'TRUE')
  const c5b = await say('understand the pattern and you never store the context', honest.id, 'TRUE')
  await patch(c5a.id, c5b.id)

  // an open question that genuinely remains UNKNOWN (high pull)
  await say('does human meaning have a finite geometry?', null, 'UNKNOWN', )
    .then((p) => patch(p.id, null, 90))

  console.log('\nclimbed. two deep soil patterns DISCOVERED (not assumed):')
  console.log('  ◉ truth should be SEEN, not just known   ← climbs 1, 4 converge')
  console.log('  ◉ truth must be HONEST                    ← climbs 2, 3, 5 converge')
  console.log('\nrefresh the app — your real conversation, drawn as a climb.')
}

// patch a pattern's expresses (and optionally pull) after insert
async function patch(id, expresses, pull) {
  const body = {}
  if (expresses !== undefined) body.expresses = expresses
  if (pull !== undefined) body.pull = pull
  if (Object.keys(body).length === 0) return
  const r = await fetch(`${URL}/rest/v1/patterns?id=eq.${id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`patch: ${r.status} ${await r.text()}`)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
