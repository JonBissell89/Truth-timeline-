// THE BREAKER v3 — against the User-rooted bidirectional fractal where a
// phrase is AUTHORED by a person and EXPRESSES a shared pattern.
// Model NOT adopted until all green. Run: npx tsx scripts/break-the-pattern.ts

import { Pool } from '../packages/engine/src/pattern'

let pass = 0, fail = 0
function check(name: string, ok: boolean, why: string) {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      → ${why}`) }
}

console.log('\n══ BREAKING THE PATTERN (authored phrase → expresses shared pattern) ══\n')

// B0: 1000-year growth — comfort persists, expressions accumulate over time.
{
  const m = new Pool(); const u = m.user('Jon')
  const comfort = m.say(u.id, 'comfort', u.id)
  m.say(u.id, 'pick a berry', comfort.id)
  m.say(u.id, 'a hot tub on a skyscraper', comfort.id)
  check('B0 1000-year growth', m.strength(comfort.id) === 2, 'pattern accumulates expressions')
}

// B1: same words, different meaning — distinct by what they express.
{
  const m = new Pool(); const u = m.user('Jon')
  const coffee = m.say(u.id, 'coffee', u.id)
  const love = m.say(u.id, 'the relationship', u.id)
  const a = m.say(u.id, "it's cold", coffee.id)
  const b = m.say(u.id, "it's cold", love.id)
  check('B1 same words, different meaning', a.expresses !== b.expresses, 'distinct by parent')
}

// B2: different words, same pattern.
{
  const m = new Pool(); const u = m.user('Jon')
  const parent = m.say(u.id, 'parenthood', u.id)
  m.say(u.id, 'I want kids', parent.id)
  m.say(u.id, "I'd like to be a parent", parent.id)
  check('B2 different words, same pattern', m.strength(parent.id) === 2, 'two phrasings, one pattern')
}

// B3: changed mind — both states survive.
{
  const m = new Pool(); const u = m.user('Jon')
  const where = m.say(u.id, 'where to live', u.id)
  m.say(u.id, 'live in a city', where.id, { state: 'TRUE' })
  m.say(u.id, 'live in a city', where.id, { state: 'FALSE' })
  const s = m.children(where.id).map(c => c.state)
  check('B3 changed mind, history kept', s.includes('TRUE') && s.includes('FALSE'), 'history kept')
}

// B4: inner ambivalence.
{
  const m = new Pool(); const u = m.user('Jon')
  const job = m.say(u.id, 'quitting my job', u.id)
  m.say(u.id, 'I should quit', job.id, { state: 'TRUE' })
  m.say(u.id, 'I should stay', job.id, { state: 'FALSE' })
  check('B4 inner ambivalence', m.children(job.id).length === 2, 'both sides coexist')
}

// B5: significance > count.
{
  const m = new Pool(); const u = m.user('Jon')
  const trauma = m.say(u.id, 'fear of dogs', u.id)
  m.say(u.id, 'a dog bit me', trauma.id, { weight: 100 })
  const chatter = m.say(u.id, 'mild preference', u.id)
  for (let i = 0; i < 50; i++) m.say(u.id, `again ${i}`, chatter.id, { weight: 1 })
  check('B5 significance outweighs repetition', m.strength(trauma.id) > m.strength(chatter.id),
    'weighted strength beats count')
}

// B6: UNKNOWNs differ in pull.
{
  const m = new Pool(); const u = m.user('Jon')
  const a = m.say(u.id, 'do I want kids?', u.id, { state: 'UNKNOWN', pull: 95 })
  const b = m.say(u.id, 'capital of Mongolia?', u.id, { state: 'UNKNOWN', pull: 2 })
  check('B6 UNKNOWNs differ in pull', (a.pull ?? 0) > (b.pull ?? 0), 'salience axis')
}

// B7: cross-person overlap via shared soil. Clean: ownerless 'comfort';
// each user SAYS a phrase that expresses it. overlap = both reach comfort.
{
  const m = new Pool()
  const jon = m.user('Jon'); const her = m.user('Her')
  const comfort = m.express('comfort', null)          // ownerless soil
  m.say(jon.id, 'I want a warm home', comfort.id, { state: 'TRUE' })
  m.say(her.id, 'coziness matters to me', comfort.id, { state: 'TRUE' })
  const shared = m.overlap(jon.id, her.id)
  check('B7 cross-person overlap via shared soil', shared.some(s => s.text === 'comfort'),
    'both authors reach comfort → overlap, no ownership hacks')
}

// B8: borrowed belief — authored by me, but expresses HER belief node.
{
  const m = new Pool(); const u = m.user('Jon')
  const herView = m.say(u.id, "her view: organic matters", u.id)
  const mine = m.say(u.id, 'I believe organic matters', herView.id)
  check('B8 borrowed belief', mine.expresses === herView.id, 'conviction flows from another node')
}

// B9: up-growth — siblings crystallize a parent that was always there.
{
  const m = new Pool(); const u = m.user('Jon')
  const needs = m.say(u.id, 'Needs', u.id)
  const food = m.say(u.id, 'Food', needs.id)
  const water = m.say(u.id, 'Water', needs.id)
  const shelter = m.say(u.id, 'Shelter', needs.id)
  const resources = m.crystallize('RESOURCES', [food.id, water.id, shelter.id], needs.id)
  check('B9 up-growth crystallizes a parent',
    m.children(resources.id).length === 3 && food.expresses === resources.id,
    'Food+Water+Shelter reveal RESOURCES above them')
}

// B10 (NEW): overlap distinguishes AGREEMENT from TENSION.
{
  const m = new Pool()
  const jon = m.user('Jon'); const her = m.user('Her')
  const move = m.express('should we move', null)
  m.say(jon.id, 'yes, lets move', move.id, { state: 'TRUE' })
  m.say(her.id, 'no, I want to stay', move.id, { state: 'FALSE' })
  // both reach 'move' → overlap; but states differ → it's TENSION not agreement
  const shared = m.overlap(jon.id, her.id)
  const reaches = shared.some(s => s.text === 'should we move')
  const jonState = m.authored(jon.id).find(p => p.expresses === move.id)?.state
  const herState = m.authored(her.id).find(p => p.expresses === move.id)?.state
  const isTension = reaches && jonState !== herState
  check('B10 overlap distinguishes agreement from tension', isTension,
    'same shared pattern + opposite states = tension, not agreement')
}

console.log(`\n── ${pass} pass · ${fail} fail ──`)
console.log(fail === 0
  ? '\nthe primitive survived all breakers. it is earned. NOW we can migrate.\n'
  : `\n${fail} still cracked. reshape — do NOT migrate yet.\n`)
