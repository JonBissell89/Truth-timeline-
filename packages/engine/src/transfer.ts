// transfer() — the working model: a CONVERSATION in, a TRUTH-GRAPH out.
//
// This is what the founder means by "a working model is one in which these
// conversations are transferred." Not me hand-picking the nodes — a real
// ordered stream of utterances run through the hybrid resolver, each one
// either grounding an existing node, starting a new proposition, or being
// recorded as non-decidable. The graph that falls out is the test.
//
// The hybrid + dogfooding curve lives here:
//   - deterministic resolves the cheap cases (duplicates, learned patterns);
//   - the LLM resolves the frontier;
//   - every LLM resolution that grounds/creates is LEARNED back into the
//     deterministic resolver, so a re-run needs the LLM less. We report
//     the frontier size so the curve is measurable, not just asserted.

import { Orenda } from './engine'
import type { Store } from './store'
import type { Resolver } from './resolver'
import type { DeterministicResolver } from './resolver-deterministic'

/** One thing said, in order. The raw input to a transfer. */
export interface ConversationTurn {
  text: string
  speaker: string
  /** Optional per-turn weight (conviction). Defaults to 1.0 — the formula
   *  that would set this is still a deferred open question. */
  weight?: number
}

export interface TransferReport {
  utterances: number
  nodesCreated: number
  groundings: number
  skipped: number
  /** How many resolutions came from the LLM vs determinism. The FRONTIER:
   *  as the system learns, llmDecisions should fall on re-runs. */
  byDeterministic: number
  byLlm: number
}

/** Run a whole conversation through the resolver into the engine.
 *  `learner` (optional) is the deterministic resolver to write learned
 *  patterns into — pass it to make the frontier shrink across turns/runs. */
export async function transfer(
  turns: ConversationTurn[],
  store: Store,
  resolver: Resolver,
  learner?: DeterministicResolver,
): Promise<{ engine: Orenda; report: TransferReport }> {
  const engine = new Orenda(store)
  const report: TransferReport = {
    utterances: 0,
    nodesCreated: 0,
    groundings: 0,
    skipped: 0,
    byDeterministic: 0,
    byLlm: 0,
  }

  for (const turn of turns) {
    // Every turn becomes a real utterance first — true provenance, the rope
    // end, regardless of whether it ends up grounding anything.
    const u = await engine.utter(turn.text, turn.speaker)
    report.utterances += 1

    const nodes = await engine.nodes()
    const decision = await resolver.resolve(turn.text, { nodes })

    if (!decision || decision.kind === 'skip') {
      report.skipped += 1
      continue
    }

    if (decision.by === 'deterministic') report.byDeterministic += 1
    else report.byLlm += 1

    if (decision.kind === 'ground') {
      await engine.ground(decision.nodeId, u.id, turn.weight ?? 1)
      report.groundings += 1
      // Dogfood: if the LLM decided this, learn it so determinism owns it
      // next time. We learn the PROPOSITION (stable), found from the node.
      if (decision.by === 'llm' && learner) {
        const node = nodes.find((n) => n.id === decision.nodeId)
        if (node) learner.learn(turn.text, node.proposition)
      }
    } else if (decision.kind === 'new') {
      await engine.createNode(decision.proposition, u.id, decision.state, turn.weight ?? 1)
      report.nodesCreated += 1
      if (decision.by === 'llm' && learner) learner.learn(turn.text, decision.proposition)
    }
  }

  return { engine, report }
}
