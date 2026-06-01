// The deterministic resolver — the CHEAP, CERTAIN side of the hybrid.
//
// Today it knows two things:
//   1. exact / near-duplicate text already grounding a node → ground it;
//   2. LEARNED PATTERNS — phrase→node mappings confirmed earlier. This is
//      the dogfooding store: every confirmed LLM resolution is written here
//      as a pattern, so next time it's deterministic and the LLM is skipped.
//
// It deliberately does NOT guess on ambiguity. If it isn't confident, it
// returns null and PASSES to the next resolver (the LLM). That refusal is
// the moat: determinism never silently merges what it can't prove.
//
// The similarity here is intentionally dumb (token overlap). It is NOT the
// product's intelligence — the LLM is. Determinism's job is to be RIGHT on
// the easy cases and HONEST (pass) on the rest, and to GROW as it learns.

import type { Resolver, Resolution, ResolverContext } from './resolver'

/** A confirmed phrase→proposition mapping. The unit the system learns.
 *  We key learning on the PROPOSITION TEXT, not the node id, because node
 *  ids are per-store and ephemeral while the proposition is the stable
 *  identity of a truth. At resolve time we find the live node whose
 *  proposition matches — so learning survives across stores/sessions. */
export interface LearnedPattern {
  /** Normalized phrase that has been confirmed to ground a proposition. */
  phrase: string
  proposition: string
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t.length > 2))
}

/** Jaccard overlap of significant tokens. Dumb on purpose. */
function overlap(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter += 1
  return inter / (ta.size + tb.size - inter)
}

export class DeterministicResolver implements Resolver {
  readonly name = 'deterministic'
  /** Confirmed patterns accumulate here. In-memory today; persisted with
   *  the store later. This growing set is what shrinks the LLM's frontier. */
  private patterns: LearnedPattern[] = []

  /** Confidence at/above which we treat a token-overlap match as certain
   *  enough to ground WITHOUT the LLM. High by design — we'd rather pass a
   *  borderline case to the LLM than merge wrongly. */
  constructor(private nearDuplicateThreshold = 0.6) {}

  /** Record a confirmed resolution as a learned pattern. Called after an
   *  LLM (or human) resolution is confirmed — the dogfooding write. We
   *  store the PROPOSITION (stable identity), not the node id (ephemeral). */
  learn(phrase: string, proposition: string): void {
    const norm = normalize(phrase)
    if (this.patterns.some((p) => p.phrase === norm && p.proposition === proposition)) return
    this.patterns.push({ phrase: norm, proposition })
  }

  async resolve(text: string, ctx: ResolverContext): Promise<Resolution | null> {
    const norm = normalize(text)

    // 1. Learned pattern — exact normalized hit, re-resolved to the LIVE
    //    node whose proposition matches. Cheapest, most certain, and it
    //    survives across stores because it keys on the proposition.
    const learned = this.patterns.find((p) => p.phrase === norm)
    if (learned) {
      const node = ctx.nodes.find((n) => n.proposition === learned.proposition)
      if (node) {
        return { kind: 'ground', nodeId: node.id, confidence: 1, by: 'deterministic' }
      }
    }

    // 2. Near-duplicate of an existing node's proposition → ground it.
    let best: { nodeId: string; score: number } | null = null
    for (const n of ctx.nodes) {
      const score = overlap(text, n.proposition)
      if (!best || score > best.score) best = { nodeId: n.id, score }
    }
    if (best && best.score >= this.nearDuplicateThreshold) {
      return { kind: 'ground', nodeId: best.nodeId, confidence: best.score, by: 'deterministic' }
    }

    // 3. Not confident. PASS — let the LLM decide. (The honest refusal.)
    return null
  }
}
