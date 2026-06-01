// Orenda engine — core types.
//
// The whole product rests on three nouns and one law:
//   - Utterance: a raw thing said. The rope to ground. Never deleted.
//   - Node: a PROPOSITION that must resolve TRUE | FALSE | UNKNOWN.
//   - Event: an append-only fact about a node (it was grounded by an
//            utterance, or its truth moved). Strength is COUNTED over
//            events; it is never a stored mutable number.
//
// The law (the moat): the rope is never cut. You can always walk from
// any node back down through its events to the utterances that made it.
// Unknown is a first-class state, not a missing value. The system can
// never silently collapse unknown into true.

/** The truth state of a proposition. UNKNOWN is first-class: it is where
 *  conversation forms, not an error or an absence. */
export type TruthState = 'TRUE' | 'FALSE' | 'UNKNOWN'

/** A raw thing said. The bottom rung of the ladder. Immutable once written. */
export interface Utterance {
  id: string
  /** Verbatim text as spoken/typed. We keep the words, not a summary. */
  text: string
  /** Who said it. 'user' or an agent id. The rope records its origin. */
  speaker: string
  /** When it entered the system. */
  saidAt: string // ISO timestamp
}

/** The KIND of event. Append-only — these are facts that happened, never
 *  edited or removed. The node's current state and strength are DERIVED
 *  by folding its events in order. */
export type NodeEvent =
  | {
      kind: 'created'
      nodeId: string
      /** The utterance that first made this proposition exist. The
       *  origination point you can always walk back to. */
      originUtteranceId: string
      /** The proposition text at creation. */
      proposition: string
      /** Initial truth state. */
      state: TruthState
      /** Weight of this first grounding. Strength is the SUM of weights,
       *  not a flat count — some witnesses count more than others. The
       *  FORMULA that sets this (speaker × conviction × independence) is a
       *  deferred open question; until it lands, callers pass 1.0 and
       *  strength behaves like a count. The slot is real now so we never
       *  re-migrate the event log to add it. */
      weight: number
      at: string
    }
  | {
      kind: 'grounded'
      nodeId: string
      /** An utterance that resolved to this same node — the accretion
       *  signal. */
      utteranceId: string
      /** Weight of this grounding (see 'created'.weight). Default 1.0. */
      weight: number
      at: string
    }
  | {
      kind: 'state_changed'
      nodeId: string
      /** What it moved to. The PREVIOUS state is recoverable by replay —
       *  we never overwrite, so the full history of truth is intact. */
      to: TruthState
      /** The utterance that justified the move, if any. Rope stays attached. */
      utteranceId: string | null
      at: string
    }

/** The DERIVED view of a node — never stored as the source of truth,
 *  always folded from its events. */
export interface NodeView {
  id: string
  proposition: string
  state: TruthState
  /** Truth-strength: the SUM of the weights of every distinct utterance
   *  that grounded this node (origin + each grounding). Said more times,
   *  more ways, by weightier witnesses = stronger. With all weights 1.0
   *  this equals the distinct-utterance count. */
  strength: number
  originUtteranceId: string
  createdAt: string
  /** Ordered ids of every utterance grounding this node — the rope, in
   *  full, walkable downward. */
  groundedBy: string[]
}
