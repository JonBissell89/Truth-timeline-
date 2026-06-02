// Prove the entropy meter against the LIVE map. Measures distinct-pattern
// count per why-depth. Honest: one conversation is not a population — the
// instrument must report that, not pretend a finding. Mirrors entropy.ts.
// Run: node scripts/test-entropy.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const env = {}
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL, SECRET = env.SUPABASE_SECRET_KEY

function depthBelow(id, childrenOf) {
  const kids = childrenOf.get(id) ?? []
  return kids.length === 0 ? 0 : 1 + Math.max(...kids.map(k => depthBelow(k.id, childrenOf)))
}
function measure(rows) {
  const patterns = rows.filter(r => !r.is_user)
  const childrenOf = new Map()
  for (const r of patterns) { const k = r.expresses; if (!childrenOf.has(k)) childrenOf.set(k, []); childrenOf.get(k).push(r) }
  const byDepth = new Map()
  for (const r of patterns) { const d = depthBelow(r.id, childrenOf); if (!byDepth.has(d)) byDepth.set(d, []); byDepth.get(d).push(r) }
  const levels = [...byDepth.keys()].sort((a, b) => a - b).map(depth => ({ depth, distinct: byDepth.get(depth).length, sample: byDepth.get(depth).map(r => r.text) }))
  const counts = levels.map(l => l.distinct)
  const monotonic = counts.every((c, i) => i === 0 || c <= counts[i - 1])
  return { levels, total: patterns.length, monotonic, enough: patterns.length >= 200 && levels.length >= 3 }
}

async function main() {
  const rows = await fetch(`${URL}/rest/v1/patterns?select=*`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } }).then(r => r.json())
  const e = measure(rows)
  console.log(`\n══ ENTROPY METER — live map (${e.total} patterns) ══\n`)
  console.log('  depth (why-ness) → distinct patterns  [surface=0, deeper=higher]\n')
  for (const l of e.levels) {
    const bar = '█'.repeat(l.distinct)
    console.log(`  why×${l.depth}  ${bar} ${l.distinct}`)
    console.log(`         { ${l.sample.slice(0, 4).join(' · ')}${l.sample.length > 4 ? ' …' : ''} }`)
  }
  console.log(`\n  monotonic shrink toward the deep: ${e.monotonic}`)
  console.log(`  enough data to conclude: ${e.enough}`)
  console.log(e.enough
    ? `\n  → ${e.monotonic ? 'Convergence holds.' : 'Convergence NOT supported.'}\n`
    : `\n  → Instrument WORKS. ${e.total} patterns is far too few to conclude —\n    the finding needs population data (many users, many domains).\n    What's proven now: the meter measures distinct-count per why-level honestly.\n`)
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
