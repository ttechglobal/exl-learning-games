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
 * before reaching for the single generic line — see
 * GameRuntime.tsx's resolveSnapshotCards(). A future game can either get
 * its own entry here (same pattern) or, once someone has DB access, a
 * real snapshot.cards row — either path works since GameRuntime checks
 * the real DB value FIRST and only falls back to this module when
 * that's missing.
 *
 * REWRITTEN per direct feedback: the original 5 cards were too wordy —
 * multi-sentence bodies with parentheticals and caveats, more like a
 * short essay than a "quick concept" meant to be read in a few seconds
 * before gameplay starts. Every card here is now ONE short idea and ONE
 * short example, nothing more. Nuance and exceptions (e.g. transition
 * metals not following the simple valence-electron shortcut) are
 * deliberately left OUT of these cards and handled instead by the
 * in-game Hint button (see teachingHints.ts), which is the right place
 * for that depth — a player who wants more than the quick version taps
 * Hint during an actual round, rather than reading it all upfront.
 *
 * CONTENT GROUNDING — still tied to what the game actually teaches:
 *   - engines/tile-match/elementData.ts: atomic number, symbol,
 *     group/family, and valence electrons, for the first 36 elements.
 *   - engines/tile-match/tileMatch.logic.ts's generateClue(): the only
 *     three clue types are exactly those three ideas — one card per
 *     real clue type, not arbitrary chemistry trivia.
 */

export interface QuickConceptCard {
  title: string;
  body: string;
}

const QUICK_CONCEPTS_BY_SLUG: Record<string, QuickConceptCard[]> = {
  "element-hunter": [
    {
      title: "How to Play",
      body: "Read the clue. Tap the element that matches. That's it!"
    },
    {
      title: "Atomic Number",
      body: "This is just the element's number on the periodic table. \"Atomic Number 6\" always means Carbon."
    },
    {
      title: "Element Families",
      body: "Elements in the same family act alike. Noble gases barely react. Metals react fast."
    },
    {
      title: "Valence Electrons",
      body: "These are an atom's outer electrons. Sodium has 1. Chlorine has 7."
    },
    {
      title: "Stuck? Use a Hint",
      body: "Tap Hint to learn the pattern. It won't give away the answer."
    }
  ]
};

export function resolveQuickConceptsForSlug(gameSlug: string): QuickConceptCard[] | undefined {
  return QUICK_CONCEPTS_BY_SLUG[gameSlug];
}