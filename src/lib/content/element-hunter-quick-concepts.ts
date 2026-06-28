/**
 * Quick Concepts content for ELEMENT HUNTER — ready to paste into the
 * `snapshot` jsonb column on this game's row in the `games` table.
 *
 * WHY THIS IS A STANDALONE FILE, NOT A SOURCE-CODE CHANGE: snapshot.cards
 * is genuinely DATA, not code — see src/types/db.ts's GameRow.snapshot
 * field and how src/app/(player)/play/[gameSlug]/PlayClient.tsx passes
 * `game.snapshot` straight from the DB row into GameRuntime, which feeds
 * it to ConceptSnapshot.tsx unchanged. There's no source file in this
 * codebase that defines Element Hunter's Quick Concepts content — it has
 * to be written into that column directly (Supabase table editor, or a
 * SQL UPDATE) rather than through a code change. This file is the
 * content to put there, not a code patch.
 *
 * CONTENT GROUNDING: written directly off what Element Hunter actually
 * teaches and how it phrases things in-game, not generic chemistry
 * filler:
 *   - src/engines/tile-match/elementData.ts: the dataset is atomic
 *     number, symbol, group/family, and valence electrons for the first
 *     36 elements (H through Kr).
 *   - src/engines/tile-match/tileMatch.logic.ts's generateClue(): the
 *     ONLY three clue types a round ever asks for are exactly those —
 *     "Atomic Number 6", a group name like "noble gas", or "4 valence
 *     electrons" — so the four cards below are an intro card plus one
 *     card per real clue type, not four arbitrary chemistry facts. A
 *     player who reads all four has now seen a worked example of every
 *     clue type they're about to be asked to match in the actual game.
 *
 * Matches the worked example ConceptSnapshot.tsx's own comment
 * references (Atomic Number -> Periodic Table -> Helpful Tip): each card
 * ends on something usable at the tile grid, not just a definition.
 */

export const ELEMENT_HUNTER_SNAPSHOT = {
  cards: [
    {
      title: "Welcome, Element Hunter",
      body: "Every round gives you one clue about an element — its atomic number, its family on the periodic table, or how many valence electrons it has. Find the tile that matches before time runs out."
    },
    {
      title: "Atomic Number",
      body: "The atomic number is just how many protons an element has — and protons never lie, so it's the most reliable clue you'll get. \"Atomic Number 6\" can only ever mean Carbon (C), no matter what else is on the grid."
    },
    {
      title: "Element Families",
      body: "Elements in the same family act alike. Noble gases (He, Ne, Ar...) barely react with anything. Alkali metals (Li, Na, K...) react fast and fiercely. Halogens (F, Cl, Br...) love to grab an extra electron. When a clue names a family, think \"what do these elements have in common?\" rather than chasing one exact element."
    },
    {
      title: "Valence Electrons",
      body: "Valence electrons are the outermost electrons — the ones involved in bonding. For most elements on the grid (the ones NOT in the middle block, like Na, Mg, Cl, Ar), just count their group straight across the periodic table: Sodium is in the 1st group, so it has 1. Chlorine is near the right edge, group 17, so it has 7. The transition metals in the middle (Fe, Cu, Zn, and friends) don't follow this neat pattern — those clues are rarer, so don't worry about memorizing them up front."
    },
    {
      title: "Helpful Tip",
      body: "Stuck on a clue? Tap Hint any time — it explains the concept behind the clue without just handing you the answer. Use it to learn the pattern, then try to spot it yourself next round."
    }
  ]
};
