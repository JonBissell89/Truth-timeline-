// RECALL — the map as real-time memory, for BOTH the agent and the human.
//
// Founder's requirement: the map must serve the agent like a human mind
// serves real-time recall (not contextual loss), AND be visually legible so
// human + agent can AGREE on a node's relevance on the same object.
//
// The binding principle: a node the agent recalls as relevant must carry,
// with it, WHY it's relevant — its climb (the rope up to its deep pattern),
// its strength, its state. The relevance is visible and contestable. If the
// agent can't show why it pulled a node, it shouldn't pull it.
//
// Every method returns Recollections — a node plus its legibility — so the
// same result the agent reasons over is the result the human sees and judges.

import type { PatternRow } from './supabase-pool'
import { SupabasePool } from './supabase-pool'

export interface Recollection {
  node: PatternRow
  /** The climb UP from this node to its deepest pattern — the rope that makes
   *  the recall legible. [self, parent, grandparent, … , deepest]. */
  climb: PatternRow[]
  /** Weighted fold beneath — how load-bearing this truth is. */
  strength: number
  /** Why this surfaced, in one human-readable phrase (for the agreement
   *  surface). */
  because: string
}

export class Recall {
  private byId: Map<string, PatternRow>
  constructor(private rows: PatternRow[]) {
    this.byId = new Map(rows.map((r) => [r.id, r]))
  }

  /** Walk UP from a node to its deepest pattern — the legibility rope. */
  private climbOf(id: string): PatternRow[] {
    const chain: PatternRow[] = []
    let cur = this.byId.get(id)
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      chain.push(cur)
      cur = cur.expresses ? this.byId.get(cur.expresses) : undefined
    }
    return chain
  }

  private wrap(node: PatternRow, because: string): Recollection {
    return {
      node,
      climb: this.climbOf(node.id),
      strength: SupabasePool.strength(node.id, this.rows),
      because,
    }
  }

  /** "What do I already know about X?" — patterns whose text matches, each
   *  with its climb so the relevance is legible. Ranked by strength. */
  about(query: string): Recollection[] {
    const q = query.toLowerCase()
    return this.rows
      .filter((r) => !r.is_user && r.text.toLowerCase().includes(q))
      .map((r) => this.wrap(r, `mentions "${query}"`))
      .sort((a, b) => b.strength - a.strength)
  }

  /** "What's still open?" — UNKNOWN nodes, ranked by pull (the questions
   *  worth resurfacing). The unknown that matters first. */
  open(): Recollection[] {
    return this.rows
      .filter((r) => r.state === 'UNKNOWN')
      .map((r) => this.wrap(r, `open question · pull ${r.pull ?? 0}`))
      .sort((a, b) => (Number(b.node.pull) || 0) - (Number(a.node.pull) || 0))
  }

  /** "What does this person hold most strongly?" — the load-bearing truths
   *  to honor. Deep patterns + high-strength authored truths. */
  core(limit = 8): Recollection[] {
    return this.rows
      .filter((r) => !r.is_user)
      .map((r) => this.wrap(r, 'load-bearing'))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit)
  }

  /** "Where does this new thing fit?" — the existing pattern a new phrase is
   *  closest to, so the agent ATTACHES rather than duplicates. Dumb overlap
   *  for now (the real resolution is the deferred hard problem); returns the
   *  best candidate WITH its climb so the human can confirm the fit. */
  fit(phrase: string): Recollection | null {
    const tokens = new Set(
      phrase.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2),
    )
    let best: { row: PatternRow; score: number } | null = null
    for (const r of this.rows) {
      if (r.is_user) continue
      const rt = new Set(r.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/))
      let inter = 0
      for (const t of tokens) if (rt.has(t)) inter++
      const score = tokens.size ? inter / tokens.size : 0
      if (!best || score > best.score) best = { row: r, score }
    }
    if (!best || best.score === 0) return null
    return this.wrap(best.row, `closest existing pattern (${Math.round(best.score * 100)}% token overlap) — confirm before attaching`)
  }
}
