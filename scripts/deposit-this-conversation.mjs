// Deposit THIS conversation into the live Orenda map.
//
// The agent (Claude, here, in VSCode) is the voice. This script is the pipe:
// it writes the propositions we grounded across this session into the founder's
// live cloud map, as the project "Building Orenda". The founder refreshes the
// web app and watches the first lights appear — the conversation that built
// Orenda becomes its first truths.
//
// Uses the SECRET key (server-side) to write as the user. The engine's
// append-only model is honored: utterances first (the rope), then node
// events (created/grounded), strength as a sum of weights. UNKNOWN nodes are
// the questions the founder deferred — first-class, not gaps.
//
// Usage: node scripts/deposit-this-conversation.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const env = {}
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = env.SUPABASE_SECRET_KEY
const EMAIL = 'jbissell89.jb@gmail.com'

const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }

async function userId() {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users?per_page=200`, { headers: H })
  const d = await r.json()
  const u = (d.users || []).find((x) => x.email === EMAIL)
  if (!u) throw new Error('user not found: ' + EMAIL)
  return u.id
}

async function insert(table, rows) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`)
  return r.json()
}

// ── The propositions this session grounded, with the utterances that ground
// them. I (the agent) extracted these from our real conversation — the same
// job the "LLM judge" did in the transfer test, now writing to the cloud.
// state: TRUE | FALSE | UNKNOWN. Each grounding utterance adds weight.
const TRUTHS = [
  {
    proposition: 'Orenda is a visual representation of truth — the visible body for the Claude agent you talk to',
    state: 'TRUE',
    utterances: [
      'this conversation is a visual representation of truth',
      'this product is you, it is the claude agent foundational in a conversational sense, but visually this is where I step in',
      'I want to use this agent, the one I am talking to — you',
    ],
  },
  {
    proposition: 'Every node is a proposition that must resolve TRUE, FALSE, or UNKNOWN',
    state: 'TRUE',
    utterances: [
      'every single attribute MUST END IN A TRUE or FALSE',
      'if it can not be a true or false statement and is unknown this is where conversations form',
    ],
  },
  {
    proposition: 'Repetition of a claim, said differently, accretes truth-strength on its node',
    state: 'TRUE',
    utterances: [
      'the more times things are said but slightly different it should hit the same node and create a truth strength signal',
    ],
  },
  {
    proposition: 'Truth-strength is weighted, not a flat count — some witnesses count more',
    state: 'TRUE',
    utterances: ['it should be weighted, thats a good idea'],
  },
  {
    proposition: 'The rope is never cut: any node walks back down to its originating utterances',
    state: 'TRUE',
    utterances: [
      'because the true and false paths it came from you, you can see the origination point about everything',
      'if I say recall that thing I said about X you can find the node',
    ],
  },
  {
    proposition: 'Orenda is the one consolidator across all projects — code, mountain-bike, cooking, therapist — one interface',
    state: 'TRUE',
    utterances: [
      'I will have a mountain bike project, a cooking project, a therapist project, all very different projects, 1 interface, 1 visual truth consolidator',
    ],
  },
  {
    proposition: "Orenda's aesthetic is dark, calm, space-traveler — Claude traveling in space",
    state: 'TRUE',
    utterances: ['dark theme space traveler future clean feel like Claude traveling in space'],
  },
  {
    proposition: 'Orenda deploys to a real URL (Vercel), not localhost — it is the real landing space',
    state: 'TRUE',
    utterances: ['I dont want to do localhost as this is not the final landing space'],
  },
  {
    proposition: 'Build the body before the skin — substrate that ticks before any render',
    state: 'TRUE',
    utterances: ['ok back to... lets get the body before the skin'],
  },
  {
    proposition: 'VSCode is one sensor feeding the map, not the home — Orenda stands alone',
    state: 'TRUE',
    utterances: ['why not just all there in one place'],
  },
  // The deferred questions — first-class UNKNOWN nodes, the seat of conversation.
  {
    proposition: 'How truth-strength disposes across people (symbiosis policy)',
    state: 'UNKNOWN',
    utterances: ['lets get it first', 'lets get the strength first then ask'],
  },
  {
    proposition: 'When two slightly-different utterances should merge into one node (resolution policy)',
    state: 'UNKNOWN',
    utterances: ['we dont need to worry about what we do with it right now, lets get it first'],
  },
  {
    proposition: 'The exact formula that sets a grounding weight (speaker × conviction × independence)',
    state: 'UNKNOWN',
    utterances: ['store the weight, defer the formula'],
  },
]

async function main() {
  const uid = await userId()
  console.log('user:', uid)

  // 1. the project
  const [project] = await insert('projects', [
    { user_id: uid, name: 'Building Orenda', type: 'code' },
  ])
  console.log('project:', project.id, project.name)

  let utterCount = 0
  let nodeCount = 0

  for (const t of TRUTHS) {
    const nodeId = randomUUID()
    // utterances first (the rope)
    const utterRows = t.utterances.map((text) => ({
      id: randomUUID(),
      project_id: project.id,
      user_id: uid,
      text,
      speaker: 'user',
    }))
    const inserted = await insert('utterances', utterRows)
    utterCount += inserted.length

    // node_events: created (origin = first utterance), then grounded for the
    // rest. PostgREST requires every row in a bulk insert to have IDENTICAL
    // keys, so we give all events the same shape (null where N/A).
    const mkEvent = (kind, uttId, proposition, state) => ({
      project_id: project.id,
      user_id: uid,
      node_id: nodeId,
      kind,
      proposition,
      state,
      weight: 1,
      utterance_id: uttId,
    })
    const events = [mkEvent('created', inserted[0].id, t.proposition, t.state)]
    for (let i = 1; i < inserted.length; i++) {
      events.push(mkEvent('grounded', inserted[i].id, null, null))
    }
    await insert('node_events', events)
    nodeCount += 1
    console.log(`  ${t.state === 'TRUE' ? '●' : t.state === 'FALSE' ? '○' : '◐'} ${t.proposition}  (strength ${inserted.length})`)
  }

  console.log(`\ndeposited: ${nodeCount} nodes from ${utterCount} utterances into "Building Orenda".`)
  console.log('refresh the web app — the first lights are on your map.')
}
main().catch((e) => {
  console.error('DEPOSIT FAILED:', e.message)
  process.exit(1)
})
