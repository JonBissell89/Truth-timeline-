// THE MICROSCOPE — the climb mechanism. The only thing that creates new
// information. A phrase, then "why does that matter?", the answer becomes its
// parent pattern, repeat. Climb until the user stops.
//
// THE LAW (founder, non-negotiable):
//   No attractors shown. No suggestions. No ontology. Just climbing.
//   The system ASKS "why did that matter?" and RECEIVES an answer — it never
//   offers one. The user's own "why" is the data. Any hint contaminates the
//   experiment the microscope exists to run.
//
// This script proves the mechanism against the earned Pool primitive
// (packages/engine/src/pattern.ts) with a SIMULATED user (the answers are
// pre-recorded here only to demonstrate the mechanism — in the live product
// they come from a real person, unprompted). Run: npx tsx scripts/climb.ts

import { Pool, type Pattern } from '../packages/engine/src/pattern'

// The climb mechanism itself — pure, tiny, suggestion-free.
// Given a starting phrase a user authored, repeatedly take the user's answer
// to "why does that matter?" and make it the parent of the previous node.
// Returns the chain surface→deep. The function NEVER generates an answer; it
// only consumes answers handed to it.
function climb(
  pool: Pool,
  userId: string,
  phrase: string,
  whyAnswers: string[], // each = the user's reply to "why does that matter?"
): Pattern[] {
  // the surface phrase, authored by the user, expressing nothing yet (root-of-climb)
  let current = pool.add(phrase, null, { author: userId })
  const chain = [current]
  for (const answer of whyAnswers) {
    // the answer is a pattern; the previous node now EXPRESSES it (climbs up)
    const parent = pool.add(answer, null)
    current.expresses = parent.id
    current = parent
    chain.push(current)
  }
  return chain
}

// What the system would SAY at each step — proof it only ever asks, never offers.
function transcript(chain: Pattern[]) {
  console.log(`\n  user: "${chain[0].text}"`)
  for (let i = 1; i < chain.length; i++) {
    const subject = i === 1 ? 'that' : `"${chain[i - 1].text}"`
    console.log(`  orenda: why does ${subject} matter?     ← (asks only, offers nothing)`)
    console.log(`  user: "${chain[i].text}"`)
  }
  console.log(`  orenda: why does "${chain[chain.length - 1].text}" matter?`)
  console.log(`  user: …(stops here — the tip of this climb)`)
}

const pool = new Pool()
const jon = pool.user('Jon')

console.log('\n══ THE MICROSCOPE — a climb (no suggestions, just "why") ══')

// SIMULATED user answers (in the live product these come from the person).
const chain = climb(pool, jon.id, 'I sat in a hot tub', [
  'comfort',
  'well-being',
  'preservation',
])
transcript(chain)

console.log('\n── the climb, as stored (surface → deep) ──\n')
chain.forEach((p, i) => console.log(`  ${'  '.repeat(i)}${i === 0 ? '◦' : '↑'} ${p.text}`))

// A second, unrelated climb by the same user — the microscope makes more
// observations. Note: we do NOT pre-link it to the first; if they converge,
// that's DATA to be discovered later, never asserted now.
const chain2 = climb(pool, jon.id, 'I shipped clean code', [
  'mastery',
  'meaning',
])
console.log('\n── a second, independent climb ──\n')
chain2.forEach((p, i) => console.log(`  ${'  '.repeat(i)}${i === 0 ? '◦' : '↑'} ${p.text}`))

console.log('\n── what the microscope produced ──')
console.log(`  ${pool.all().length} patterns from 2 climbs.`)
console.log('  No floor named. No attractor assumed. Just the user\'s own climbs.')
console.log('  Whether these two climbs ever share deep soil is a question for')
console.log('  DATA to answer — the microscope only observes; it never concludes.\n')
