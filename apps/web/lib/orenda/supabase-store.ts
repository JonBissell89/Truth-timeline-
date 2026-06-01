// SupabaseStore — the engine's Store seam, backed by Postgres + RLS.
//
// The engine (packages/engine) never changed: it talks to the Store
// interface. MemoryStore was the in-memory impl; this is the cloud impl.
// Same append-only contract — addUtterance + appendEvent, no update/delete
// (the DB also revokes UPDATE/DELETE, so the rope is uncuttable by law).
//
// Scoped to ONE project of ONE user. The Supabase client carries the user's
// session, so RLS guarantees we only ever read/write this user's rows; the
// project_id scopes which strand. The cross-project consolidator reads
// across projects separately (see consolidator.ts).
import type { Store, Utterance, NodeEvent } from '@orenda/engine'
import type { SupabaseClient } from '@supabase/supabase-js'

type Sb = SupabaseClient

export class SupabaseStore implements Store {
  constructor(
    private sb: Sb,
    private userId: string,
    private projectId: string,
  ) {}

  async addUtterance(u: Utterance): Promise<void> {
    const { error } = await this.sb.from('utterances').insert({
      id: u.id,
      project_id: this.projectId,
      user_id: this.userId,
      text: u.text,
      speaker: u.speaker,
      said_at: u.saidAt,
    })
    if (error) throw new Error(`addUtterance: ${error.message}`)
  }

  async appendEvent(e: NodeEvent): Promise<void> {
    // Map the engine's discriminated event into the flat event row.
    const row: Record<string, unknown> = {
      project_id: this.projectId,
      user_id: this.userId,
      node_id: e.nodeId,
      kind: e.kind,
      at: e.at,
    }
    if (e.kind === 'created') {
      row.proposition = e.proposition
      row.state = e.state
      row.weight = e.weight
      row.utterance_id = e.originUtteranceId
    } else if (e.kind === 'grounded') {
      row.weight = e.weight
      row.utterance_id = e.utteranceId
    } else {
      // state_changed
      row.state = e.to
      row.utterance_id = e.utteranceId
    }
    const { error } = await this.sb.from('node_events').insert(row)
    if (error) throw new Error(`appendEvent: ${error.message}`)
  }

  async allUtterances(): Promise<Utterance[]> {
    const { data, error } = await this.sb
      .from('utterances')
      .select('id, text, speaker, said_at')
      .eq('project_id', this.projectId)
      .order('said_at', { ascending: true })
    if (error) throw new Error(`allUtterances: ${error.message}`)
    return (data ?? []).map((r) => ({
      id: r.id as string,
      text: r.text as string,
      speaker: r.speaker as string,
      saidAt: r.said_at as string,
    }))
  }

  async allEvents(): Promise<NodeEvent[]> {
    const { data, error } = await this.sb
      .from('node_events')
      .select('node_id, kind, proposition, state, weight, utterance_id, at')
      .eq('project_id', this.projectId)
      .order('at', { ascending: true })
    if (error) throw new Error(`allEvents: ${error.message}`)
    return (data ?? []).map((r) => rowToEvent(r as EventRow))
  }
}

interface EventRow {
  node_id: string
  kind: 'created' | 'grounded' | 'state_changed'
  proposition: string | null
  state: 'TRUE' | 'FALSE' | 'UNKNOWN' | null
  weight: number | null
  utterance_id: string | null
  at: string
}

function rowToEvent(r: EventRow): NodeEvent {
  if (r.kind === 'created') {
    return {
      kind: 'created',
      nodeId: r.node_id,
      originUtteranceId: r.utterance_id!,
      proposition: r.proposition!,
      state: r.state!,
      weight: Number(r.weight ?? 1),
      at: r.at,
    }
  }
  if (r.kind === 'grounded') {
    return {
      kind: 'grounded',
      nodeId: r.node_id,
      utteranceId: r.utterance_id!,
      weight: Number(r.weight ?? 1),
      at: r.at,
    }
  }
  return {
    kind: 'state_changed',
    nodeId: r.node_id,
    to: r.state!,
    utteranceId: r.utterance_id,
    at: r.at,
  }
}
