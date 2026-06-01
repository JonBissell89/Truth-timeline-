// The LLM resolver — the FRONTIER side of the hybrid.
//
// It is called ONLY for utterances the deterministic resolver passed on
// (genuine ambiguity / novelty). Its job: decide whether this utterance
// grounds an existing node, starts a new proposition (with a T/F/UNKNOWN
// state), or asserts nothing decidable.
//
// IMPORTANT — honesty about what's wired:
//   There is no Anthropic API key in this repo yet (BYO/connector is a
//   later inch). So the live model call is NOT made here. Instead this
//   resolver takes a `judge` function the caller injects. In production
//   that function calls Claude through the connector. For the working-model
//   TRANSFER of a real conversation, the caller supplies a `judge` backed
//   by a pre-extracted pass (Claude having read the transcript) — which is
//   exactly the agent doing the job, just batched instead of live.
//
// The frontier SHRINKS: every resolution this returns, once confirmed, is
// written back to the deterministic resolver as a learned pattern, so the
// same utterance never reaches the LLM again.

import type { Resolver, Resolution, ResolverContext } from './resolver'

/** The judgment function. In production: Claude via the connector. For the
 *  transfer test: a lookup over a pre-extracted pass. Returns null if even
 *  the model declines to decide (rare — usually 'skip'). */
export type LlmJudge = (
  text: string,
  ctx: ResolverContext,
) => Promise<Resolution | null>

export class LlmResolver implements Resolver {
  readonly name = 'llm'
  constructor(private judge: LlmJudge) {}
  async resolve(text: string, ctx: ResolverContext): Promise<Resolution | null> {
    const out = await this.judge(text, ctx)
    if (!out) return null
    // Stamp provenance so the shrinking-frontier metric is honest.
    return { ...out, by: 'llm' }
  }
}
