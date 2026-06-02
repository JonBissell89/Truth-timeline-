'use client'

import { useMemo } from 'react'
import type { PatternRow } from '@/lib/orenda/supabase-pool'
import { SupabasePool } from '@/lib/orenda/supabase-pool'

// The climb diagram. The pattern model rendered as the fractal it is:
// surface phrases (leaves) rise through patterns toward deep shared soil
// (roots). Vertical = depth of climb (how many "why"s deep). Size = strength
// (weighted fold beneath). UNKNOWN pulses. NO floor is labelled or
// highlighted — the deep patterns look like any other; the experiment must
// not be contaminated by visually privileging an attractor.
//
// This is also a window into the agent's memory: each node is a place the
// agent can climb down from to recall the grounding.

const STATE_COLOR: Record<string, string> = {
  TRUE: 'var(--true)',
  FALSE: 'var(--false)',
  UNKNOWN: 'var(--unknown)',
}

interface Placed {
  row: PatternRow
  x: number
  y: number
  r: number
  depth: number
}

export default function ClimbMap({ rows, email }: { rows: PatternRow[]; email: string }) {
  const placed = useMemo(() => layout(rows), [rows])
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  async function signOut() {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="text-lg font-light tracking-[0.25em] text-ink-100">ORENDA</span>
          <span className="text-xs text-ink-500">
            {rows.filter((r) => !r.is_user).length} patterns
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-500">
          <span>{email}</span>
          <button onClick={signOut} className="text-ink-300 hover:text-amber">sign out</button>
        </div>
      </header>

      {rows.filter((r) => !r.is_user).length === 0 ? (
        <Empty />
      ) : (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">
          {/* edges first (the climbs) */}
          {placed.map((p) => {
            const parent = p.row.expresses ? placed.find((q) => q.row.id === p.row.expresses) : null
            if (!parent) return null
            return (
              <line
                key={`e-${p.row.id}`}
                x1={p.x} y1={p.y} x2={parent.x} y2={parent.y}
                stroke="var(--space-3)" strokeWidth={1} opacity={0.5}
              />
            )
          })}
          {/* nodes */}
          {placed.map((p) => (
            <Light key={p.row.id} p={p} byId={byId} />
          ))}
        </svg>
      )}
    </main>
  )
}

function Light({ p, byId }: { p: Placed; byId: Map<string, PatternRow> }) {
  const color = STATE_COLOR[p.row.state ?? ''] ?? 'var(--ink-300)'
  const isUnknown = p.row.state === 'UNKNOWN'
  const parent = p.row.expresses ? byId.get(p.row.expresses) : null
  return (
    <g className={isUnknown ? 'orenda-unknown' : undefined}>
      <title>{`${p.row.text}${parent ? `\n  ↑ ${parent.text}` : ''}`}</title>
      <circle cx={p.x} cy={p.y} r={p.r * 2.2} fill={color} opacity={0.07} />
      <circle cx={p.x} cy={p.y} r={p.r} fill={color} opacity={0.85} />
      {p.r > 10 && (
        <text x={p.x} y={p.y + p.r + 13} textAnchor="middle" fontSize="11" fill="var(--ink-300)">
          {truncate(p.row.text, 26)}
        </text>
      )}
    </g>
  )
}

function Empty() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-ink-300">Nothing climbed yet.</p>
        <p className="mt-2 text-sm text-ink-500">
          Say something true. Orenda asks why it matters, and why that matters, and
          climbs — each answer a step deeper. The diagram is the residue of the climb.
        </p>
      </div>
    </div>
  )
}

// Layout: depth (how many `expresses` hops to a root) sets vertical band —
// surface phrases low, deep patterns high (rising toward shared soil).
// Horizontal is a stable hash so a node keeps its place.
function layout(rows: PatternRow[]): Placed[] {
  const phrasePatterns = rows.filter((r) => !r.is_user)
  const depthOf = (r: PatternRow): number => {
    let d = 0
    let cur: PatternRow | undefined = r
    const seen = new Set<string>()
    while (cur && cur.expresses && !seen.has(cur.id)) {
      seen.add(cur.id)
      d++
      cur = rows.find((x) => x.id === cur!.expresses)
    }
    return d
  }
  const maxDepth = Math.max(1, ...phrasePatterns.map(depthOf))
  return phrasePatterns.map((row) => {
    const depth = depthOf(row)
    const h = hash(row.id)
    const x = 100 + (h % 800)
    // deeper = higher on screen (smaller y). surface phrases near bottom.
    const band = 1 - depth / (maxDepth + 1)
    const y = 90 + band * 540 + ((h >> 8) % 40)
    const r = 6 + Math.log2(1 + SupabasePool.strength(row.id, rows)) * 6
    return { row, x, y, r, depth }
  })
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}
