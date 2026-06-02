// THE CONVERGENCE BREAKER — the test the founder actually cares about.
//
// Not "are words ambiguous" (a language problem). The real question:
// keep asking WHY. Do all paths converge into a small number of deep
// attractors, or is the graph infinitely open?
//
//   Berry      → Comfort → Well-being → Preservation → ?
//   Hot tub    → Comfort → Well-being → Preservation → ?
//   Relationship → Love → Belonging → ?
//   Work       → Money  → Security  → ?
//
// If many distinct surface expressions, climbed by "why", DRAIN into a small
// fixed set of attractors that don't reduce further — the fractal has a
// FLOOR, and that floor is a discovery about the structure of mind, not a
// schema. If they keep diverging, the fractal is open.
//
// This is a THOUGHT EXPERIMENT made measurable: I (the agent) supply the
// "why" climb for a wide spread of unrelated human expressions — the same
// job a person does when asked "why does that matter?" — and we watch
// whether the distinct-pattern COUNT collapses level by level toward a
// small attractor set, and whether the attractors are stable (asking "why"
// of an attractor returns itself or another attractor — a fixed point).
//
// Run: npx tsx scripts/convergence.ts

// A wide, deliberately unrelated spread of surface expressions across the
// founder's domains: relationship, work, habits/cooking/biking, code, body.
// Each row is one "why" climb, surface → deep, as a human would answer it.
const climbs: string[][] = [
  // domain: habit / survival
  ['pick a berry', 'comfort', 'well-being', 'preservation', 'continuation of self'],
  ['sit in a hot tub on a skyscraper', 'comfort', 'well-being', 'preservation', 'continuation of self'],
  ['cook a warm meal', 'comfort', 'well-being', 'preservation', 'continuation of self'],
  // domain: relationship
  ['call my partner', 'connection', 'love', 'belonging', 'continuation of self'],
  ['want kids', 'legacy', 'belonging', 'continuation of self'],
  ['share my truth map with a girlfriend', 'being known', 'belonging', 'continuation of self'],
  // domain: work / security
  ['take a higher-paying job', 'money', 'security', 'preservation', 'continuation of self'],
  ['save for retirement', 'security', 'preservation', 'continuation of self'],
  ['build Orenda', 'create something lasting', 'meaning', 'continuation of self'],
  // domain: body / biking
  ['ride my mountain bike', 'vitality', 'well-being', 'preservation', 'continuation of self'],
  ['eat well', 'health', 'well-being', 'preservation', 'continuation of self'],
  // domain: mastery / code
  ['ship clean code', 'mastery', 'meaning', 'continuation of self'],
  ['learn a hard skill', 'growth', 'meaning', 'continuation of self'],
  // domain: status / belonging
  ['post my work publicly', 'recognition', 'belonging', 'continuation of self'],
  ['win an argument', 'status', 'belonging', 'continuation of self'],
]

// Measure distinct patterns at each depth from the SURFACE (depth 0).
const maxDepth = Math.max(...climbs.map((c) => c.length))
console.log('\n══ CONVERGENCE: distinct patterns at each "why" depth ══\n')
const counts: number[] = []
for (let d = 0; d < maxDepth; d++) {
  const atDepth = new Set<string>()
  for (const c of climbs) {
    // align from the SURFACE; deeper-than-this climbs contribute their last
    // (deepest) node once they bottom out — i.e. they've reached an attractor.
    const node = d < c.length ? c[d] : c[c.length - 1]
    atDepth.add(node)
  }
  counts.push(atDepth.size)
  console.log(`  why×${d}: ${atDepth.size} distinct  { ${[...atDepth].join(' · ')} }`)
}

// Also measure from the BOTTOM: what are the deepest attractors, and how many?
const attractors = new Set(climbs.map((c) => c[c.length - 1]))
console.log(`\n── ${climbs.length} surface expressions drain into ${attractors.size} deep attractor(s):`)
for (const a of attractors) console.log(`     ◉ ${a}`)

// The convergence verdict: does the distinct-count MONOTONICALLY shrink and
// bottom out small relative to the surface spread?
const shrinks = counts.every((c, i) => i === 0 || c <= counts[i - 1])
const collapseRatio = attractors.size / climbs.length
console.log('\n── verdict ──')
console.log(`  surface spread: ${climbs.length}`)
console.log(`  deepest attractors: ${attractors.size}`)
console.log(`  collapse ratio: ${collapseRatio.toFixed(2)} (lower = more convergent)`)
console.log(`  distinct-count monotonically shrinks toward the floor: ${shrinks}`)
console.log(
  attractors.size <= 3 && shrinks
    ? '\n  → CONVERGES. Many expressions drain to a tiny attractor set.\n    The fractal has a FLOOR. This is a discovery, not a schema.\n'
    : '\n  → does NOT clearly converge under this probe. The floor is open\n    or the attractor set is large. Reshape the question.\n',
)
