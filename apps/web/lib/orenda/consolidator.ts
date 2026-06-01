// The consolidator — the ONE map across ALL projects.
//
// A user has many projects of different kinds (code, mountain_bike,
// cooking, therapist). Each project's truth-graph is folded by the engine
// from its own event log. The consolidator gathers every project's nodes
// into one cross-project view — the single visual truth map the founder
// wants: "1 interface, 1 visual truth consolidator," tracking all projects.
//
// It does NOT merge nodes across projects (that is symbiosis-of-self, a
// later question — same deferred resolution problem, one level up). It
// TAGS each node with its project so the map can lay them out as distinct
// strands that share one space. Cross-project relating comes later.
import { Orenda } from '@orenda/engine'
import type { NodeView } from '@orenda/engine'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseStore } from './supabase-store'

export interface ProjectMeta {
  id: string
  name: string
  type: string
}

export interface ConsolidatedNode extends NodeView {
  projectId: string
  projectName: string
  projectType: string
}

export interface ConsolidatedMap {
  projects: ProjectMeta[]
  nodes: ConsolidatedNode[]
}

/** Read the whole cross-project map for the logged-in user. RLS scopes it
 *  to them; we just iterate their projects and fold each. */
export async function consolidate(
  sb: SupabaseClient,
  userId: string,
): Promise<ConsolidatedMap> {
  const { data: projectRows, error } = await sb
    .from('projects')
    .select('id, name, type')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`consolidate/projects: ${error.message}`)

  const projects: ProjectMeta[] = (projectRows ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    type: p.type as string,
  }))

  const nodes: ConsolidatedNode[] = []
  for (const p of projects) {
    const engine = new Orenda(new SupabaseStore(sb, userId, p.id))
    const projectNodes = await engine.nodes()
    for (const n of projectNodes) {
      nodes.push({ ...n, projectId: p.id, projectName: p.name, projectType: p.type })
    }
  }

  return { projects, nodes }
}
