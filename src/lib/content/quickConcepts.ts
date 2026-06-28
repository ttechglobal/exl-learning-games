/**
 * lib/content/quickConcepts.ts
 *
 * Quick Concept cards shown before a mission starts (ConceptSnapshot,
 * via GameRuntime's "snapshot" phase) and revisitable afterward ("View
 * Concept Summary" on ReflectionScreen, the "reviewingConcepts" phase).
 *
 * WHY THIS EXISTS AS CODE, NOT A DB COLUMN LOOKUP: GameRow.snapshot is a
 * real jsonb column and GameRuntime reads from it first — that path is
 * unchanged. But Element Hunter's actual row never had real content
 * written into that column (a manual DB edit this session could
 * describe but not perform), so GameRuntime always fell through to a
 * single generic one-line fallback ("Get ready — your mission is about
 * to begin") for every game, which is what "Quick Concepts isn't
 * showing" actually meant in practice — it WAS showing, just not
 * Element Hunter's real content.
 *
 * This module is a second, PER-SLUG fallback that GameRuntime checks
 * before reaching for the single generic line — see GameRuntime.tsx's
 * resolveFallbackSnapshotCards(). Element Hunter gets its real 5-card
 * content this way, in code, without requiring any database step at
 * all. A future game can either get its own entry here (same pattern)
 * or, once someone has DB access, a real snapshot.cards row — either
 * path works since GameRuntime checks the real DB value FIRST and only
 * falls back to this module when that's missing.
 *
 * CONTENT GROUNDING for Element Hunter — written directly off what the
 * game actually teaches and how it phrases things in-game, not generic
 * chemistry filler:
 *   - engines/tile-match/elementData.ts: the dataset is atomic number,
 *     symbol, group/family, and valence electrons for the first 36
 *     elements (H through Kr).
 *   - engines/tile-match/tileMatch.logic.ts's generateClue(): the ONLY
 *     three clue types a round ever asks for are exactly those —
 *     "Atomic Number 6", a group name like "noble gas", or "4 valence
 *     electrons" — so the four content cards below are one per real
 *     clue type, not arbitrary chemistry facts. A player who reads all
 *     of them has seen a worked example of every clue type they're
 *     about to be asked to match.
 *   - The valence-electron card deliberately does NOT claim the simple
 *     "count the group number" shortcut applies to the transition
 *     metals (Sc through Zn) that are also in this game's dataset —
 *     that shortcut only holds for main-group elements, and overstating
 *     it would teach something that breaks on this game's own content.
 */

export interface QuickConceptCard {
  title: string;
  body: string;
}

const QUICK_CONCEPTS_BY_SLUG: Record<string, QuickConceptCard[]> = {
  "element-hunter": [
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

export function resolveQuickConceptsForSlug(gameSlug: string): QuickConceptCard[] | undefined {
  return QUICK_CONCEPTS_BY_SLUG[gameSlug];
}