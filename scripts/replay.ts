// Replay proof — the first body, ticking.
//
// There is no data in Orenda yet except one conversation: the one in
// which Orenda was conceived. So the only honest seed is THAT
// conversation. We replay its real claims as utterances, let nodes
// precipitate, and watch:
//   - strength TICK as the same truth is restated, differently;
//   - at least one node move UNKNOWN -> TRUE with a witnessing utterance
//     (never silently);
//   - at least one node STAY UNKNOWN — a real open question, the seat of
//     a future conversation, first-class on the map;
//   - recall() walk the rope back down to origin.
//
// Run: npx tsx scripts/replay.ts
//
// This proves the substrate (nodes, T/F/UNKNOWN, accretion, the rope)
// before any skin. The biofabric render comes after there is truth to render.

import { Orenda, MemoryStore } from '../packages/engine/src/index'

async function main() {
  const o = new Orenda(new MemoryStore())

  // --- A TRUE node that accretes strength across restatements ---------
  // The founder said this several ways across the conversation.
  const conversationIsModel = await o.assert(
    'this conversation we are having right now should be a working model of what I want to build',
    'The conversation itself is a working model of the product',
    'TRUE',
  )
  await o.restate(
    conversationIsModel,
    'this conversation is a visual representation of truth',
  )
  await o.restate(
    conversationIsModel,
    'Orenda is the visual body for the Claude agent you already talk to',
  )
  await o.restate(
    conversationIsModel,
    'the conversation IS the input, the map IS the output, same screen',
  )

  // --- A node BORN unknown, then witnessed TRUE (never silently) ------
  const everyNodeTF = await o.assert(
    'every single attribute MUST END IN A TRUE or FALSE',
    'Every node is a proposition that must resolve TRUE, FALSE, or UNKNOWN',
    'UNKNOWN',
  )
  // It became settled truth when the founder confirmed the framing. The
  // move carries the witnessing utterance — unknown -> true is an event.
  const witness = await o.utter(
    'if it can not be a true or false statement and is unknown this is where conversations form',
  )
  await o.setState(everyNodeTF, 'TRUE', witness.id)
  await o.ground(everyNodeTF, witness.id)

  // --- Accretion law as its own TRUE node -----------------------------
  const accretion = await o.assert(
    'the more times things are said, but slightly different, it should hit the same node and create a truth strength signal',
    'Repetition of a claim, said differently, accretes truth-strength on its node',
    'TRUE',
  )
  await o.restate(
    accretion,
    'said once is a candidate, said three ways by two people is grounded',
  )
  // A WEIGHTED grounding — strength is a SUM of weights, not a flat count.
  // This restatement is a low-conviction echo, so it adds only 0.3. With
  // the formula deferred, weights are passed explicitly for now; the proof
  // is that strength can be fractional, i.e. truly weighted.
  await o.restate(accretion, 'maybe repetition strengthens things', 'user', 0.3)

  // --- The moat as a TRUE node ----------------------------------------
  const ropeNeverCut = await o.assert(
    'because the true and false paths it came from you, you can see the origination point about everything',
    'The rope is never cut: any node can be walked back down to its originating utterances',
    'TRUE',
  )

  // --- GENUINE UNKNOWN NODES — deferred, first-class, not gaps ---------
  // The founder explicitly deferred these. They are not missing features.
  // They are open questions the conversation is still circling — the seat
  // of future conversation, rendered as UNKNOWN on the map.
  await o.assert(
    'we dont need to worry about what we do with it right now, lets get it first',
    'How truth-strength disposes across people (symbiosis policy)',
    'UNKNOWN',
  )
  await o.assert(
    'lets get the strength first then ask',
    'When two slightly-different utterances should merge into one node (resolution policy)',
    'UNKNOWN',
  )

  // --- A node that MOVED from one truth to another (history kept) -----
  // "build it in C:/dev" was asserted, then the founder redirected to the
  // Desktop. We do not delete the old truth; we append the change.
  const location = await o.assert(
    'think very hard about the most scalable location for this',
    'Orenda lives at C:/dev/orenda (off Desktop, stable root)',
    'TRUE',
  )
  const moved = await o.utter('I just didn\'t want anything in heron — put it on my desktop')
  await o.setState(location, 'FALSE', moved.id) // the old location is now false
  const newLocation = await o.assert(
    'create a folder on my desktop',
    'Orenda lives at Desktop/Orenda, a peer to Heron, never inside it',
    'TRUE',
  )

  // ------------------------------------------------------------------
  // RENDER THE MAP (text, for now — biofabric is a later inch)
  // ------------------------------------------------------------------
  const nodes = await o.nodes()
  const glyph = (s: string) => (s === 'TRUE' ? '●' : s === 'FALSE' ? '○' : '◐')

  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  ORENDA — the first map (replayed from the founding convo)')
  console.log('══════════════════════════════════════════════════════════\n')
  for (const n of nodes) {
    console.log(
      `  ${glyph(n.state)} [${n.state.padEnd(7)}] strength ${n.strength}  —  ${n.proposition}`,
    )
  }

  console.log('\n── strongest TRUE node, rope walked DOWN to origin ──\n')
  const hits = await o.recall('working model')
  for (const h of hits) {
    console.log(`  ${glyph(h.node.state)} ${h.node.proposition}  (strength ${h.node.strength})`)
    for (const u of h.rope) {
      console.log(`      └─ "${u.text}"`)
    }
  }

  console.log('\n── the UNKNOWN nodes (the seat of future conversation) ──\n')
  for (const n of nodes.filter((x) => x.state === 'UNKNOWN')) {
    console.log(`  ◐ ${n.proposition}`)
  }

  console.log(
    `\n  ${nodes.length} nodes · ` +
      `${nodes.filter((n) => n.state === 'TRUE').length} true · ` +
      `${nodes.filter((n) => n.state === 'FALSE').length} false · ` +
      `${nodes.filter((n) => n.state === 'UNKNOWN').length} unknown\n`,
  )
}

main()
