// Orenda engine — the core. The brain both faces attach to: the human
// sees it rendered; the agent (Claude) traverses it to recall.
//
// Three operations write to the append-only log:
//   utter(text, speaker)        -> an Utterance enters. Just the rope end.
//   createNode(proposition,...) -> a proposition is born from an utterance.
//   ground(nodeId, utteranceId) -> another utterance lands on a node (+1 strength).
//   setState(nodeId, to, ...)   -> the truth moves (append, never overwrite).
//
// One operation reads:
//   nodes() -> folds the event log into the current NodeView list.
//
// And the recall that makes this a tool for the agent:
//   recall(query) -> find nodes whose proposition matches, and for each,
//                    walk the rope DOWN to the originating utterances.
//
// Nothing here knows about a database, a UI, biofabric, or a domain. It
// is the domain-blind substrate. Skin and store are seams elsewhere.

import type { NodeEvent, NodeView, TruthState, Utterance } from './types'
import type { Store } from './store'

let counter = 0
function id(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}

export class Orenda {
  constructor(private store: Store) {}

  /** A raw thing said enters the system. Returns the utterance id so the
   *  caller can ground a node on it. The rope end, recorded first. */
  async utter(text: string, speaker = 'user'): Promise<Utterance> {
    const u: Utterance = {
      id: id('utt'),
      text,
      speaker,
      saidAt: new Date().toISOString(),
    }
    await this.store.addUtterance(u)
    return u
  }

  /** A proposition is born from an utterance. Every node MUST be a
   *  statement that resolves TRUE | FALSE | UNKNOWN — that is enforced by
   *  the TruthState type. UNKNOWN is the honest default for a fresh claim
   *  the conversation hasn't settled. */
  async createNode(
    proposition: string,
    originUtteranceId: string,
    state: TruthState = 'UNKNOWN',
  ): Promise<string> {
    const nodeId = id('node')
    const ev: NodeEvent = {
      kind: 'created',
      nodeId,
      originUtteranceId,
      proposition,
      state,
      at: new Date().toISOString(),
    }
    await this.store.appendEvent(ev)
    return nodeId
  }

  /** Another utterance resolved to an existing node. THIS is accretion —
   *  the truth-strength signal. Said again, slightly differently, hitting
   *  the same node: +1. We do not auto-decide that two utterances are the
   *  same node here; the caller asserts the match (manual for now, by
   *  design — resolution policy is a deferred UNKNOWN of the product). */
  async ground(nodeId: string, utteranceId: string): Promise<void> {
    await this.store.appendEvent({
      kind: 'grounded',
      nodeId,
      utteranceId,
      at: new Date().toISOString(),
    })
  }

  /** The truth of a node moves. We APPEND the change; the previous state
   *  remains in the log, so the full history of how a truth evolved is
   *  always recoverable. Unknown -> True is a real, witnessed event with
   *  an utterance attached; it can never happen silently. */
  async setState(
    nodeId: string,
    to: TruthState,
    utteranceId: string | null,
  ): Promise<void> {
    await this.store.appendEvent({
      kind: 'state_changed',
      nodeId,
      to,
      utteranceId,
      at: new Date().toISOString(),
    })
  }

  /** Convenience: an utterance that creates a brand-new proposition.
   *  Returns the node id. */
  async assert(
    text: string,
    proposition: string,
    state: TruthState = 'UNKNOWN',
    speaker = 'user',
  ): Promise<string> {
    const u = await this.utter(text, speaker)
    return this.createNode(proposition, u.id, state)
  }

  /** Convenience: an utterance that grounds an EXISTING node (+1 strength).
   *  This is the everyday motion — saying the same truth another way. */
  async restate(nodeId: string, text: string, speaker = 'user'): Promise<void> {
    const u = await this.utter(text, speaker)
    await this.ground(nodeId, u.id)
  }

  /** Fold the append-only event log into the current view of every node.
   *  The events are the source of truth; NodeView is always derived. This
   *  is the read the human renders and the agent traverses. */
  async nodes(): Promise<NodeView[]> {
    const events = await this.store.allEvents()
    const map = new Map<string, NodeView>()

    for (const e of events) {
      if (e.kind === 'created') {
        map.set(e.nodeId, {
          id: e.nodeId,
          proposition: e.proposition,
          state: e.state,
          // strength counts the origin utterance + every later grounding
          strength: 1,
          originUtteranceId: e.originUtteranceId,
          createdAt: e.at,
          groundedBy: [e.originUtteranceId],
        })
      } else if (e.kind === 'grounded') {
        const n = map.get(e.nodeId)
        if (!n) continue
        // distinct utterances only — re-grounding the same utterance is
        // not a stronger truth, it is a duplicate. Convergent grounding
        // (different utterances) is what earns strength.
        if (!n.groundedBy.includes(e.utteranceId)) {
          n.groundedBy.push(e.utteranceId)
          n.strength += 1
        }
      } else if (e.kind === 'state_changed') {
        const n = map.get(e.nodeId)
        if (!n) continue
        n.state = e.to
      }
    }

    return [...map.values()]
  }

  /** RECALL — the operation that makes Orenda a tool for the agent, not
   *  just a picture for the human. "Recall that thing I said about X":
   *  find nodes whose proposition matches, and for each, return the rope
   *  walked DOWN to the originating utterances. The agent reads the
   *  structure; the origin is always recoverable. */
  async recall(query: string): Promise<RecallHit[]> {
    const q = query.toLowerCase()
    const [nodes, utterances] = await Promise.all([
      this.nodes(),
      this.store.allUtterances(),
    ])
    const byId = new Map(utterances.map((u) => [u.id, u]))

    return nodes
      .filter((n) => n.proposition.toLowerCase().includes(q))
      .sort((a, b) => b.strength - a.strength)
      .map((n) => ({
        node: n,
        // the rope, walked down: every utterance that grounded this truth,
        // in the order they were said, origin first.
        rope: n.groundedBy
          .map((uid) => byId.get(uid))
          .filter((u): u is Utterance => u != null),
      }))
  }
}

/** A recall result: the node plus the rope down to its grounding utterances. */
export interface RecallHit {
  node: NodeView
  rope: Utterance[]
}
