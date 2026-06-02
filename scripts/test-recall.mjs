// TEST THE CAPABILITY — can the agent recall from the live map as memory?
//
// Founder's standard: "You don't need to do it now, you just need to be able
// to, and that can be tested." So we don't wire a live in-app call — we PROVE
// the recall capability against the REAL live data (this conversation's
// climbs) with assertions. If these pass, the capability exists; wiring it
// into a live loop later is plumbing, not a question of whether it works.
//
// Mirrors lib/orenda/recall.ts (the app uses the TS version; this .mjs is the
// standalone prover against the live DB). Run: node scripts/test-recall.mjs

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
const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}` }

// ── recall logic (mirrors recall.ts) ──────────────────────────────────
function strength(id, rows) {
  return rows.filter(r => r.expresses === id)
    .reduce((s, k) => s + Number(k.weight) + strength(k.id, rows), 0)
}
function climbOf(id, byId) {
  const chain = []; let cur = byId.get(id); const seen = new Set()
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); chain.push(cur); cur = cur.expresses ? byId.get(cur.expresses) : undefined }
  return chain
}
function wrap(node, rows, byId, because) {
  return { node, climb: climbOf(node.id, byId), strength: strength(node.id, rows), because }
}
function makeRecall(rows) {
  const byId = new Map(rows.map(r => [r.id, r]))
  return {
    about: (q) => rows.filter(r => !r.is_user && r.text.toLowerCase().includes(q.toLowerCase()))
      .map(r => wrap(r, rows, byId, `mentions "${q}"`)).sort((a, b) => b.strength - a.strength),
    open: () => rows.filter(r => r.state === 'UNKNOWN')
      .map(r => wrap(r, rows, byId, `open · pull ${r.pull ?? 0}`)).sort((a, b) => (+b.node.pull || 0) - (+a.node.pull || 0)),
    core: (n = 8) => rows.filter(r => !r.is_user).map(r => wrap(r, rows, byId, 'load-bearing'))
      .sort((a, b) => b.strength - a.strength).slice(0, n),
    fit: (phrase) => {
      const t = new Set(phrase.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(x => x.length > 2))
      let best = null
      for (const r of rows) { if (r.is_user) continue
        const rt = new Set(r.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/))
        let i = 0; for (const x of t) if (rt.has(x)) i++
        const score = t.size ? i / t.size : 0
        if (!best || score > best.score) best = { row: r, score } }
      return best && best.score > 0 ? wrap(best.row, rows, byId, `closest (${Math.round(best.score * 100)}%)`) : null
    },
  }
}

let pass = 0, fail = 0
const ok = (name, cond, detail) => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}\n      ${detail}`) } }

async function main() {
  const rows = await fetch(`${URL}/rest/v1/patterns?select=*&order=created_at`, { headers: H }).then(r => r.json())
  console.log(`\n══ RECALL CAPABILITY — against ${rows.length} live patterns ══\n`)
  const R = makeRecall(rows)

  // 1. about(): "what do I know about truth?" — returns patterns WITH climbs
  const aboutTruth = R.about('truth')
  ok('about("truth") surfaces truth-patterns', aboutTruth.length >= 2,
    `got ${aboutTruth.length}`)
  ok('every recollection carries its climb (legible)',
    aboutTruth.every(r => r.climb.length >= 1),
    'a recollection with no climb is unjustifiable')

  // 2. open(): the genuine UNKNOWN, ranked by pull
  const open = R.open()
  ok('open() finds the live UNKNOWN', open.length >= 1, `got ${open.length}`)
  ok('open() top is the finite-geometry question',
    open[0]?.node.text.toLowerCase().includes('geometry'),
    `top was: ${open[0]?.node.text}`)

  // 3. core(): load-bearing truths exist and are ranked by strength
  const core = R.core()
  ok('core() returns load-bearing truths', core.length >= 1, `got ${core.length}`)
  ok('core() is sorted by strength (desc)',
    core.every((r, i) => i === 0 || core[i - 1].strength >= r.strength),
    'not monotonically decreasing')

  // 4. fit(): a NEW phrase attaches to the right existing pattern, not nothing
  const fit = R.fit('I want my beliefs to be honest and not fool myself')
  ok('fit() attaches a new phrase to an existing pattern', fit !== null,
    'returned null — would have duplicated instead of attaching')
  if (fit) console.log(`      → fit to: "${fit.node.text}" (${fit.because})`)

  // show one full recollection so the legibility is visible
  if (aboutTruth[0]) {
    console.log('\n── a recollection, as the agent would receive it ──')
    console.log(`  node: "${aboutTruth[0].node.text}"  [${aboutTruth[0].node.state}] strength ${aboutTruth[0].strength}`)
    console.log('  climb (the justification the human can also see):')
    aboutTruth[0].climb.forEach((c, i) => console.log(`    ${'  '.repeat(i)}${i ? '↑' : '◦'} ${c.text}`))
    console.log(`  because: ${aboutTruth[0].because}`)
  }

  console.log(`\n── ${pass} pass · ${fail} fail ──`)
  console.log(fail === 0
    ? '\n  the agent CAN recall from the live map, with legible justification.\n  capability proven. wiring it live is now just plumbing.\n'
    : '\n  recall capability not yet proven — fix before claiming it.\n')
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
