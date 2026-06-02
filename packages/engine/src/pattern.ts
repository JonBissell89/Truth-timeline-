// THE PRIMITIVE — v2, under test. Founder's model:
//
//   The root is always the USER. Every phrase is a pattern that slots into a
//   group beneath them; groups get finer over time AND new groups crystallize
//   ABOVE accumulated siblings. One primitive (a pattern), one relationship
//   (expresses → its parent), growing BOTH directions:
//
//     User
//      └ "I think therefore I am"
//          ├ Think → Mind
//          └ Am → Body → Needs → {Food, Water, Shelter} → RESOURCES → ...
//
// Down-growth: a new expression slots under a group (everyday).
// Up-growth:   accumulated siblings CRYSTALLIZE a shared parent that was
//              always implicitly there (berry + hot tub → comfort).
//
// One pool of patterns shared across all users; a User is just a root
// pattern. Two users' trees grow DOWN into the same deep patterns
// (Resources, Comfort) — that shared soil is where overlap lives.
//
// Simplicity law: if this grows long, the model is wrong.

export type State = 'TRUE' | 'FALSE' | 'UNKNOWN'

export interface Pattern {
  id: string
  text: string
  /** The parent pattern this expresses, or null at a root (a User, or a
   *  not-yet-parented deep pattern). Re-parentable when a new parent
   *  crystallizes above it (up-growth) — that is an append of a new edge,
   *  the old lineage stays recoverable. */
  expresses: string | null
  at: number
  /** Is this pattern a USER root? Users are the only roots that are people. */
  isUser?: boolean
  /** B5: significance weight of THIS expression (one dog-bite >> 50 repeats).
   *  Default 1; the formula that sets it is still deferred, but the SLOT is
   *  proven necessary by the breaker. */
  weight?: number
  /** B6: salience/pull of an open question (do-I-want-kids >> Mongolia). */
  pull?: number
  state?: State
  /** WHO authored this phrase (a user id), if anyone. Distinct from
   *  `expresses` (WHAT it is about). A phrase is authored by a person AND
   *  expresses a shared pattern — that separation is exactly why two people
   *  overlap: different authors, different phrases, same expressed pattern.
   *  Deep soil patterns (comfort, resources) have no author — ownerless. */
  author?: string
}

export class Pool {
  private patterns: Pattern[] = []
  private seq = 0

  add(text: string, expresses: string | null, opts: Partial<Pattern> = {}): Pattern {
    const p: Pattern = { id: `p${++this.seq}`, text, expresses, at: this.seq, ...opts }
    this.patterns.push(p)
    return p
  }

  /** A person — a root pattern. The top of their fractal. */
  user(name: string): Pattern {
    return this.add(name, null, { isUser: true })
  }

  /** A person says something: a phrase AUTHORED by them, EXPRESSING a pattern
   *  (its parent in the shared soil). Author = who; expresses = what about. */
  say(author: string, text: string, expressesId: string, opts: Partial<Pattern> = {}): Pattern {
    return this.add(text, expressesId, { ...opts, author })
  }

  /** Down-growth: express a phrase under a parent (no author / structural). */
  express(text: string, parentId: string, opts: Partial<Pattern> = {}): Pattern {
    return this.add(text, parentId, opts)
  }

  /** Up-growth: a parent crystallizes above existing siblings — they were
   *  always this; we name it now. Re-parents the children onto the new node
   *  (append-only: we add the new node + new edges; nothing is destroyed). */
  crystallize(text: string, childIds: string[], parentId: string | null = null): Pattern {
    const parent = this.add(text, parentId)
    for (const c of this.patterns) if (childIds.includes(c.id)) c.expresses = parent.id
    return parent
  }

  children(id: string): Pattern[] {
    return this.patterns.filter((p) => p.expresses === id)
  }

  /** STRENGTH — emerges, now WEIGHTED (B5): a pattern is as strong as the
   *  significance accumulated beneath it, recursively. */
  strength(id: string): number {
    return this.children(id).reduce(
      (s, k) => s + (k.weight ?? 1) + this.strength(k.id),
      0,
    )
  }

  /** Walk UP from any pattern to its root (the User / deepest parent). The
   *  rope, both as lineage and as "whose mind is this". */
  rootOf(id: string): Pattern | undefined {
    let cur = this.get(id)
    while (cur && cur.expresses) cur = this.get(cur.expresses)
    return cur
  }

  /** Phrases a user authored — their own sayings (the surface of their tree). */
  authored(userId: string): Pattern[] {
    return this.patterns.filter((p) => p.author === userId)
  }

  /** REACH — every pattern a user touches by walking UP from each phrase they
   *  authored, through the shared soil to the deepest ownerless patterns.
   *  A deep pattern (comfort) is in the reach of everyone who climbs to it —
   *  ownerless soil; people reach into it. */
  reach(userId: string): Set<string> {
    const reached = new Set<string>()
    for (const p of this.authored(userId)) {
      reached.add(p.id)
      let cur: Pattern | undefined = p
      while (cur && cur.expresses) {
        reached.add(cur.expresses)
        cur = this.get(cur.expresses)
      }
    }
    return reached
  }

  /** OVERLAP — falls out for free: the patterns BOTH users reach. Where two
   *  trees touch the same soil. No merge, no promotion, no ownership — just
   *  set intersection of two reaches. */
  overlap(userA: string, userB: string): { patternId: string; text: string }[] {
    const a = this.reach(userA)
    const b = this.reach(userB)
    return [...a]
      .filter((id) => b.has(id))
      .map((id) => ({ patternId: id, text: this.get(id)?.text ?? '?' }))
  }

  all(): Pattern[] { return [...this.patterns] }
  get(id: string): Pattern | undefined { return this.patterns.find((p) => p.id === id) }
}
