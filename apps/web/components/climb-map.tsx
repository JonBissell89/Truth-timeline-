'use client'

import { useMemo, useState } from 'react'
import type { PatternRow } from '@/lib/orenda/supabase-pool'
import { SupabasePool } from '@/lib/orenda/supabase-pool'
import { measureEntropy, type EntropyReading } from '@/lib/orenda/entropy'

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
  const entropy = useMemo(() => measureEntropy(rows), [rows])
  const [selected, setSelected] = useState<string | null>(null)
  const [meterOpen, setMeterOpen] = useState(false)

  // the climb UP from a node — its legibility rope (self → deepest pattern)
  const climbOf = (id: string): PatternRow[] => {
    const chain: PatternRow[] = []
    let cur = byId.get(id)
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id); chain.push(cur)
      cur = cur.expresses ? byId.get(cur.expresses) : undefined
    }
    return chain
  }

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
          <button
            onClick={() => setMeterOpen((v) => !v)}
            className={meterOpen ? 'text-amber' : 'text-ink-300 hover:text-amber'}
          >
            entropy
          </button>
          <span>{email}</span>
          <button onClick={signOut} className="text-ink-300 hover:text-amber">sign out</button>
        </div>
      </header>

      {meterOpen && <EntropyMeter reading={entropy} />}

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
            <Light
              key={p.row.id}
              p={p}
              byId={byId}
              selected={selected === p.row.id}
              onSelect={() => setSelected(selected === p.row.id ? null : p.row.id)}
            />
          ))}
        </svg>
      )}

      {/* the AGREEMENT SURFACE — click a node, see why it's relevant, judge it */}
      {selected && (
        <Inspector
          climb={climbOf(selected)}
          strength={SupabasePool.strength(selected, rows)}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}

// The agreement surface: a recalled node shown WITH its legibility — the
// climb up to its deep pattern, its strength, its state — so the human can
// look and agree or disagree that it's relevant. Same shape the agent
// reasons over (a Recollection): if the agent can't show why, it can't claim.
function Inspector({
  climb, strength, onClose,
}: { climb: PatternRow[]; strength: number; onClose: () => void }) {
  const node = climb[0]
  if (!node) return null
  return (
    <aside className="absolute right-0 top-0 z-20 h-full w-80 border-l border-space-3 bg-space-1/95 p-6 backdrop-blur">
      <button onClick={onClose} className="absolute right-4 top-4 text-ink-500 hover:text-ink-100">×</button>
      <div className="mb-1 text-xs uppercase tracking-wider text-ink-500">
        {node.state ?? 'pattern'} · strength {strength}
      </div>
      <h2 className="mb-6 text-lg font-light text-ink-100">{node.text}</h2>
      <div className="mb-2 text-xs uppercase tracking-wider text-ink-500">the climb (why it&apos;s here)</div>
      <ol className="space-y-2">
        {climb.map((c, i) => (
          <li key={c.id} className="text-sm" style={{ paddingLeft: i * 12 }}>
            <span className="text-ink-500">{i === 0 ? '◦' : '↑'}</span>{' '}
            <span className={i === climb.length - 1 ? 'text-amber' : 'text-ink-300'}>{c.text}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-ink-500">
        Does this node belong here? You and the agent read the same climb — agree, or correct it.
      </p>
    </aside>
  )
}

function Light({
  p, byId, selected, onSelect,
}: {
  p: Placed
  byId: Map<string, PatternRow>
  selected: boolean
  onSelect: () => void
}) {
  const color = STATE_COLOR[p.row.state ?? ''] ?? 'var(--ink-300)'
  const isUnknown = p.row.state === 'UNKNOWN'
  const parent = p.row.expresses ? byId.get(p.row.expresses) : null
  return (
    <g
      className={isUnknown ? 'orenda-unknown' : undefined}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      <title>{`${p.row.text}${parent ? `\n  ↑ ${parent.text}` : ''}`}</title>
      {selected && (
        <circle cx={p.x} cy={p.y} r={p.r + 5} fill="none" stroke="var(--amber)" strokeWidth={1.5} />
      )}
      <circle cx={p.x} cy={p.y} r={p.r * 2.2} fill={color} opacity={0.07} />
      <circle cx={p.x} cy={p.y} r={p.r} fill={color} opacity={selected ? 1 : 0.85} />
      {p.r > 10 && (
        <text x={p.x} y={p.y + p.r + 13} textAnchor="middle" fontSize="11" fill="var(--ink-300)">
          {truncate(p.row.text, 26)}
        </text>
      )}
    </g>
  )
}

// THE ENTROPY METER — the paper, rendered. Distinct-pattern count per
// why-depth as bars. NO floor named — just the counts. Reports honestly when
// there isn't enough data to conclude (the instrument works; the finding
// needs population data). This is the experiment's live readout.
function EntropyMeter({ reading }: { reading: EntropyReading }) {
  const max = Math.max(1, ...reading.levels.map((l) => l.distinct))
  return (
    <aside className="absolute left-1/2 top-20 z-20 w-[28rem] -translate-x-1/2 rounded-lg border border-space-3 bg-space-1/95 p-5 backdrop-blur">
      <div className="mb-1 text-xs uppercase tracking-wider text-ink-500">the experiment</div>
      <h2 className="mb-4 text-sm font-light text-ink-100">
        Does entropy decrease as we climb?
      </h2>
      <div className="space-y-2">
        {reading.levels.map((l) => (
          <div key={l.depth} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-right text-xs text-ink-500">why×{l.depth}</span>
            <div className="h-3 flex-1 overflow-hidden rounded bg-space-0">
              <div
                className="h-full rounded bg-unknown/70"
                style={{ width: `${(l.distinct / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-xs text-ink-300">{l.distinct}</span>
          </div>
        ))}
      </div>
      <p className={`mt-4 text-xs ${reading.enough ? 'text-amber' : 'text-ink-500'}`}>
        {reading.verdict}
      </p>
    </aside>
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
