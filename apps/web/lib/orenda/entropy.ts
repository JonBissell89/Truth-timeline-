// THE ENTROPY METER — the paper.
//
// The experiment (founder): does entropy DECREASE as we climb? Measure the
// distinct-pattern COUNT at each "why"-depth. If many surface expressions
// drain into fewer patterns level by level, meaning has structure —
// convergence is real EVEN BEFORE the final attractors are known.
//
// THE LAW: this NEVER names a floor. It counts distinct patterns per depth.
// It does not label, rank, or privilege any deep pattern. The attractor, if
// one exists, is an OUTPUT no one is shown until it emerges from population
// data — naming candidates would contaminate the climbs.
//
// Depth = how many `expresses` hops a pattern is from the surface. We compute
// it from the BOTTOM: surface phrases (authored, leaves) are depth 0; their
// parents depth 1; and so on UP toward shared soil.

import type { PatternRow } from './supabase-pool'

export interface EntropyLevel {
  depth: number
  /** distinct patterns occupied at this why-depth */
  distinct: number
  /** the pattern ids at this depth (for drill-down, not for labeling a floor) */
  ids: string[]
}

export interface EntropyReading {
  levels: EntropyLevel[]
  /** total distinct patterns (non-user) measured */
  total: number
  /** does the distinct-count monotonically shrink as depth increases? */
  monotonic: boolean
  /** surface count ÷ deepest count — higher = more convergence */
  compression: number
  /** honest: is there enough data to CONCLUDE anything? */
  enough: boolean
  /** one-line honest verdict */
  verdict: string
}

/** Depth of a pattern = longest chain of `expresses` BELOW it (how deep the
 *  climbs that reach it run). A leaf phrase = 0; a pattern many phrases climb
 *  into = higher. We measure from children up so "deeper why" = higher depth. */
function depthBelow(id: string, childrenOf: Map<string | null, PatternRow[]>): number {
  const kids = childrenOf.get(id) ?? []
  if (kids.length === 0) return 0
  return 1 + Math.max(...kids.map((k) => depthBelow(k.id, childrenOf)))
}

export function measureEntropy(rows: PatternRow[]): EntropyReading {
  const patterns = rows.filter((r) => !r.is_user)
  const childrenOf = new Map<string | null, PatternRow[]>()
  for (const r of patterns) {
    const k = r.expresses
    if (!childrenOf.has(k)) childrenOf.set(k, [])
    childrenOf.get(k)!.push(r)
  }

  // group distinct patterns by their depth-below (their level in the climb)
  const byDepth = new Map<number, string[]>()
  for (const r of patterns) {
    const d = depthBelow(r.id, childrenOf)
    if (!byDepth.has(d)) byDepth.set(d, [])
    byDepth.get(d)!.push(r.id)
  }

  const levels: EntropyLevel[] = [...byDepth.keys()]
    .sort((a, b) => a - b)
    .map((depth) => ({ depth, distinct: byDepth.get(depth)!.length, ids: byDepth.get(depth)! }))

  // convergence = as depth (why-ness) RISES, distinct count should FALL.
  // Order levels surface→deep (depth ascending) and check the count shrinks.
  const counts = levels.map((l) => l.distinct)
  const monotonic = counts.every((c, i) => i === 0 || c <= counts[i - 1])
  const surface = counts[0] ?? 0
  const deepest = counts[counts.length - 1] || 1
  const compression = surface / deepest

  // honesty: one conversation is not a population. Need many independent
  // climbs across users/domains before any verdict is evidence.
  const enough = patterns.length >= 200 && levels.length >= 3
  const verdict = !enough
    ? `Instrument working; ${patterns.length} patterns is far too few to conclude. Needs population data.`
    : monotonic
      ? `Distinct-count shrinks at every level (×${compression.toFixed(1)} compression). Convergence holds in this data.`
      : `Distinct-count does NOT monotonically shrink here. Convergence not supported by this data.`

  return { levels, total: patterns.length, monotonic, compression, enough, verdict }
}
