// SupabasePool — the earned Pattern primitive, backed by the live `patterns`
// table. The in-memory Pool (packages/engine/src/pattern.ts) proved the model
// against 11 breakers; this is the same shape over Supabase, so the live app
// runs the proven model. Read methods fold the flat rows; writes append.
//
// This is also the AGENT's memory store: patterns persist, context does not.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PatternRow {
  id: string
  text: string
  expresses: string | null
  author: string | null
  is_user: boolean
  weight: number
  pull: number | null
  state: 'TRUE' | 'FALSE' | 'UNKNOWN' | null
  created_at: string
}

export class SupabasePool {
  constructor(private sb: SupabaseClient) {}

  /** Ensure the user's root pattern exists (a person IS a pattern). Returns
   *  its id. Idempotent. */
  async ensureUser(userId: string, name: string): Promise<string> {
    const { data: existing } = await this.sb
      .from('patterns')
      .select('id')
      .eq('author', userId)
      .eq('is_user', true)
      .maybeSingle()
    if (existing) return existing.id as string
    const { data, error } = await this.sb
      .from('patterns')
      .insert({ text: name, author: userId, is_user: true })
      .select('id')
      .single()
    if (error) throw new Error(`ensureUser: ${error.message}`)
    return data.id as string
  }

  /** A person says something: a phrase authored by them, expressing a parent
   *  pattern (its place in the climb). */
  async say(
    userId: string,
    text: string,
    expresses: string | null,
    opts: { weight?: number; pull?: number; state?: PatternRow['state'] } = {},
  ): Promise<string> {
    const { data, error } = await this.sb
      .from('patterns')
      .insert({
        text,
        expresses,
        author: userId,
        weight: opts.weight ?? 1,
        pull: opts.pull ?? null,
        state: opts.state ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error(`say: ${error.message}`)
    return data.id as string
  }

  /** All patterns visible to the caller (their own + ownerless soil, per RLS). */
  async all(): Promise<PatternRow[]> {
    const { data, error } = await this.sb
      .from('patterns')
      .select('id, text, expresses, author, is_user, weight, pull, state, created_at')
      .order('created_at', { ascending: true })
    if (error) throw new Error(`all: ${error.message}`)
    return (data ?? []) as PatternRow[]
  }

  /** Strength = weighted fold of everything beneath a pattern (emerges). */
  static strength(id: string, rows: PatternRow[]): number {
    const kids = rows.filter((r) => r.expresses === id)
    return kids.reduce((s, k) => s + Number(k.weight) + SupabasePool.strength(k.id, rows), 0)
  }
}
