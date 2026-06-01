// Resolution — the hybrid that turns an utterance into a decision about
// which node (if any) it grounds. This is THE deferred-hard-problem made
// into a seam, so the engine never bakes in one strategy.
//
// The founder's insight: resolution is a HYBRID whose mix SHIFTS over time.
//   - deterministic handles what it can prove cheaply (exact/near-duplicate,
//     and patterns it has ALREADY LEARNED from confirmed resolutions);
//   - the LLM handles genuine ambiguity it hasn't learned yet;
//   - every confirmed LLM resolution becomes a deterministic pattern, so
//     the LLM is needed LESS over time. It works itself out of a job.
//     (The dogfooding loop applied to extraction itself.)
//
// The moat holds: the LLM PROPOSES; confirmation GROUNDS; the confirmed
// resolution becomes a rule. Unknown is never silently collapsed to true —
// an unresolved utterance becomes a NEW node (a candidate), never a guessed
// merge.

import type { NodeView, TruthState } from './types'

/** What a resolver decides for one incoming utterance. */
export type Resolution =
  | {
      /** This utterance grounds an EXISTING node (+strength). */
      kind: 'ground'
      nodeId: string
      /** How sure, 0..1. Determinism is ~1.0; the LLM reports its own. */
      confidence: number
      /** Which resolver decided — for telemetry and the shrinking-frontier
       *  metric (what % still needs the LLM). */
      by: 'deterministic' | 'llm'
    }
  | {
      /** This utterance is a NEW proposition. The honest default when no
       *  existing node is a confident match — never a guessed merge. */
      kind: 'new'
      proposition: string
      state: TruthState
      by: 'deterministic' | 'llm'
    }
  | {
      /** This utterance asserts nothing decidable (chatter, a question).
       *  It is still recorded as an utterance, but grounds no node. */
      kind: 'skip'
      by: 'deterministic' | 'llm'
    }

export interface ResolverContext {
  /** The current map — the candidate nodes an utterance might ground. */
  nodes: NodeView[]
}

export interface Resolver {
  readonly name: string
  /** Decide what this utterance does. Return null to PASS to the next
   *  resolver in the chain (e.g. determinism passes ambiguity to the LLM). */
  resolve(text: string, ctx: ResolverContext): Promise<Resolution | null>
}

/** Chains resolvers: try each in order, first non-null wins. Put the
 *  cheap/certain deterministic resolver first and the LLM last. As the
 *  deterministic one learns, fewer utterances fall through to the LLM. */
export class HybridResolver implements Resolver {
  readonly name = 'hybrid'
  constructor(private chain: Resolver[]) {}
  async resolve(text: string, ctx: ResolverContext): Promise<Resolution | null> {
    for (const r of this.chain) {
      const out = await r.resolve(text, ctx)
      if (out) return out
    }
    return null
  }
}
