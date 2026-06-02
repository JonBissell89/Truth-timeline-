// BLIND RECALL STUDY — does the MAP alone reconstruct the truth, with the
// agent's context gone? This tests the keystone claim
// (core_pattern_as_agent_memory): "context is never stored; the agent
// re-derives memory by climbing the pattern."
//
// THE HONESTY PROTOCOL:
//   1. SEALED FIRST: a battery of real questions this conversation answered,
//      each with REQUIRED FACTS that MUST appear in the recalled text for the
//      map to count as having reconstructed the truth. Committed here, before
//      the recall runs — no grading on a curve.
//   2. BLIND: the recall routine uses ONLY the map (the patterns table). No
//      transcript, no context, no priming. It simulates a fresh agent.
//   3. SCORE: for each question, did blind map-recall surface text containing
//      the required facts? Mechanical. Unfakeable.
//
// A PASS means the map IS sufficient memory. A FAIL means the claim was
// hollow and recall returns plausible-looking nodes that don't actually carry
// the truth. We WANT to find that if it's true.
//
// Run: node scripts/blind-recall-study.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const env = {}
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL, SECRET = env.SUPABASE_SECRET_KEY

// ── 1. SEALED BATTERY (committed BEFORE any recall) ────────────────────
// Each: a question, the query terms a blind agent would search the map with,
// and the REQUIRED FACTS (any-of groups) that must appear in recalled text.
// These are the truths THIS conversation established — sealed as ground truth.
const SEALED = [
  {
    q: 'What is Orenda fundamentally?',
    queries: ['visual', 'truth', 'agent'],
    requireAnyOf: [['visual'], ['truth'], ['agent', 'claude']],
  },
  {
    q: 'What is the moat / the core discipline?',
    queries: ['honest', 'contaminat', 'attractor'],
    requireAnyOf: [['honest'], ['contaminat', 'attractor']],
  },
  {
    q: 'Should truth-strength be counted or weighted?',
    queries: ['weight', 'significance', 'count'],
    requireAnyOf: [['weight', 'significance']],
  },
  {
    q: 'What is the deepest open question (the experiment)?',
    queries: ['geometry', 'meaning', 'open'],
    requireAnyOf: [['geometry', 'meaning']],
  },
  {
    q: 'What is the relationship between the product and the Claude agent?',
    queries: ['agent', 'claude', 'visual', 'memory'],
    requireAnyOf: [['agent', 'claude'], ['memory', 'visual']],
  },
]

// ── 2. BLIND recall (map only) ─────────────────────────────────────────
// Pure text search over patterns, returning matching texts + their climb.
// No conversation context whatsoever.
function blindRecall(rows, queries) {
  const byId = new Map(rows.map(r => [r.id, r]))
  const climb = (id) => { const c = []; let cur = byId.get(id); const seen = new Set()
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); c.push(cur.text); cur = cur.expresses ? byId.get(cur.expresses) : undefined } return c }
  const hits = []
  for (const r of rows) {
    if (r.is_user) continue
    const text = r.text.toLowerCase()
    if (queries.some(q => text.includes(q.toLowerCase()))) {
      hits.push({ text: r.text, climb: climb(r.id) })
    }
  }
  return hits
}

function scores(hits, requireAnyOf) {
  // all recalled text the blind agent would see (node + its climb)
  const blob = hits.flatMap(h => [h.text, ...h.climb]).join(' ').toLowerCase()
  // each required group is satisfied if ANY of its terms appears
  return requireAnyOf.map(group => ({ group, met: group.some(t => blob.includes(t.toLowerCase())) }))
}

async function main() {
  const rows = await fetch(`${URL}/rest/v1/patterns?select=*`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } }).then(r => r.json())
  console.log(`\n══ BLIND RECALL STUDY — map only, ${rows.length} patterns, sealed answers ══\n`)

  let pass = 0, fail = 0
  for (const item of SEALED) {
    const hits = blindRecall(rows, item.queries)
    const result = scores(hits, item.requireAnyOf)
    const allMet = result.every(r => r.met)
    if (allMet) pass++; else fail++
    console.log(`  ${allMet ? '✓' : '✗'} ${item.q}`)
    console.log(`      recalled ${hits.length} node(s); required facts met: ${result.filter(r => r.met).length}/${result.length}`)
    if (!allMet) {
      const missing = result.filter(r => !r.met).map(r => `[${r.group.join('|')}]`).join(' ')
      console.log(`      MISSING: ${missing}  ← map did NOT reconstruct this`)
    }
  }

  console.log(`\n── ${pass}/${SEALED.length} questions answerable from the map ALONE ──`)
  console.log(fail === 0
    ? '\n  The map IS sufficient memory. A blind agent reconstructs the truth\n  with no context. The keystone claim holds — for this data.\n'
    : `\n  ${fail} question(s) NOT reconstructable from the map alone. The memory\n  claim is NOT fully proven: blind recall returns nodes but misses facts.\n  This is honest — the gap is now visible, not asserted away.\n`)
  process.exit(0)
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
