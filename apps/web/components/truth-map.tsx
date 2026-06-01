'use client'

import { useMemo, useState } from 'react'
import type { ConsolidatedMap, ConsolidatedNode } from '@/lib/orenda/consolidator'
import { createClient } from '@/lib/supabase/client'

// The first skin: the living-lights band of the cross-project truth map.
// Nodes are distant lights. Size = strength (truth that's been said more,
// more ways, by weightier witnesses burns brighter). Colour = state:
//   ● TRUE    calm aqua-green
//   ○ FALSE   dimmed, receded
//   ◐ UNKNOWN cool blue, PULSING — the seat of conversation, alive.
// Projects are strands sharing one space; selecting one focuses it.
// (Biofabric grid = the mid/far band, a later inch. This is up-close.)

const STATE_COLOR: Record<string, string> = {
  TRUE: 'var(--true)',
  FALSE: 'var(--false)',
  UNKNOWN: 'var(--unknown)',
}

export default function TruthMap({ map, email }: { map: ConsolidatedMap; email: string }) {
  const [focus, setFocus] = useState<string | null>(null) // projectId or null = all

  const shown = useMemo(
    () => (focus ? map.nodes.filter((n) => n.projectId === focus) : map.nodes),
    [map.nodes, focus],
  )

  const positioned = useMemo(() => layout(shown), [shown])

  async function signOut() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* top bar — quiet instrument panel */}
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="text-lg font-light tracking-[0.25em] text-ink-100">ORENDA</span>
          <span className="text-xs text-ink-500">{map.nodes.length} truths · {map.projects.length} projects</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-500">
          <span>{email}</span>
          <button onClick={signOut} className="text-ink-300 hover:text-amber">sign out</button>
        </div>
      </header>

      {/* project strands — the consolidator's filter */}
      <nav className="absolute left-6 top-20 z-10 flex flex-col gap-2">
        <Chip label="all projects" active={focus === null} onClick={() => setFocus(null)} />
        {map.projects.map((p) => (
          <Chip
            key={p.id}
            label={`${p.name}`}
            sub={p.type}
            active={focus === p.id}
            onClick={() => setFocus(p.id)}
          />
        ))}
      </nav>

      {/* the field of lights */}
      {map.nodes.length === 0 ? (
        <Empty />
      ) : (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">
          {positioned.map((p) => (
            <Light key={p.node.id} {...p} />
          ))}
        </svg>
      )}
    </main>
  )
}

function Chip({ label, sub, active, onClick }: { label: string; sub?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-left text-xs transition ${
        active
          ? 'border-amber/60 bg-space-2 text-ink-100'
          : 'border-space-3 bg-space-1/60 text-ink-300 hover:border-space-3 hover:text-ink-100'
      }`}
    >
      {label}
      {sub && <span className="ml-2 text-ink-500">{sub}</span>}
    </button>
  )
}

function Empty() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-ink-300">The map is empty.</p>
        <p className="mt-2 text-sm text-ink-500">
          Truth precipitates here as you talk. Nothing has been said yet — when it is,
          it lands as a light, and grows brighter each time it&apos;s said again, a different way.
        </p>
      </div>
    </div>
  )
}

interface Placed {
  node: ConsolidatedNode
  x: number
  y: number
  r: number
}

// Deterministic scatter from the node id, so the map is stable across
// renders (a light keeps its place). Size from strength (log-scaled so a
// strength-30 node doesn't swallow the field).
function layout(nodes: ConsolidatedNode[]): Placed[] {
  return nodes.map((node) => {
    const h = hash(node.id)
    const x = 120 + (h % 760)
    const y = 120 + ((h >> 8) % 460)
    const r = 6 + Math.log2(1 + Math.max(0, node.strength)) * 7
    return { node, x, y, r }
  })
}

function Light({ node, x, y, r }: Placed) {
  const color = STATE_COLOR[node.state] ?? 'var(--unknown)'
  const isUnknown = node.state === 'UNKNOWN'
  return (
    <g className={isUnknown ? 'orenda-unknown' : undefined} style={{ cursor: 'default' }}>
      <title>{`${node.proposition}\n[${node.state}] strength ${node.strength} · ${node.projectName}`}</title>
      {/* glow */}
      <circle cx={x} cy={y} r={r * 2.2} fill={color} opacity={0.08} />
      {/* core */}
      <circle cx={x} cy={y} r={r} fill={color} opacity={node.state === 'FALSE' ? 0.45 : 0.9} />
      {/* label for the brighter lights only — keep the field calm */}
      {r > 12 && (
        <text x={x} y={y + r + 14} textAnchor="middle" fontSize="11" fill="var(--ink-300)">
          {truncate(node.proposition, 28)}
        </text>
      )}
    </g>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}
