// Store interface + an in-memory implementation.
//
// The engine never talks to a database directly. It talks to this
// interface. Today the only implementation is in-memory (so the body
// ticks with zero infra). Later a Postgres/Supabase adapter implements
// the SAME interface and the engine code does not change. That is why
// the engine lives in packages/ and the store is a seam, not a backend.
//
// The store is APPEND-ONLY by contract: it exposes appendEvent and
// addUtterance, but no update or delete. The graph only grows. History
// is never rewritten — that is the rope-never-cut law made structural.

import type { NodeEvent, Utterance } from './types'

export interface Store {
  addUtterance(u: Utterance): Promise<void>
  appendEvent(e: NodeEvent): Promise<void>
  /** Read the full immutable streams. The engine folds these into views. */
  allUtterances(): Promise<Utterance[]>
  allEvents(): Promise<NodeEvent[]>
}

/** In-memory store. Real, append-only, ordered. No persistence yet —
 *  that is a later inch (the body before the skin, and the DB before the
 *  sync). Good enough to watch truth accrete today. */
export class MemoryStore implements Store {
  private utterances: Utterance[] = []
  private events: NodeEvent[] = []

  async addUtterance(u: Utterance): Promise<void> {
    this.utterances.push(u)
  }

  async appendEvent(e: NodeEvent): Promise<void> {
    this.events.push(e)
  }

  async allUtterances(): Promise<Utterance[]> {
    return [...this.utterances]
  }

  async allEvents(): Promise<NodeEvent[]> {
    return [...this.events]
  }
}
