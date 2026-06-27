/**
 * lib/content/gameCardMeta.ts
 *
 * Per-game card art + one-sentence description — extracted from
 * HomePage.tsx, where this lookup originally lived as a local, private
 * constant only the homepage's "Popular Games" section used. Now also
 * needed by the new /worlds/[subject] "Choose Game" page (per the product
 * brief: subject-world game cards should look "similar to the Popular
 * Games section on the homepage"), so it's promoted to a shared module
 * rather than duplicated a second time.
 *
 * CONTENT GAP, fixed here rather than carried forward: the original
 * HomePage.tsx version only had entries for "atom-forge" and
 * "element-hunter" — "build-the-atom" had neither art nor a description,
 * meaning its homepage/worlds card would have silently rendered a broken
 * image and an empty description paragraph. Added a real entry below
 * rather than leaving the gap, since a second page now depends on this
 * data being complete.
 */

export const GAME_CARD_ART: Record<string, string> = {
  "atom-forge": "/mascot/card-atom-forge.svg",
  "element-hunter": "/mascot/card-element-hunter.svg",
  /**
   * No bespoke illustration exists yet for this game (unlike the other
   * two) — reusing atom-forge's art as a placeholder so the card isn't
   * broken, but this should get its own artwork before this game is
   * actually promoted/featured anywhere prominent.
   */
  "build-the-atom": "/mascot/card-atom-forge.svg"
};

export const GAME_CARD_DESC: Record<string, string> = {
  "atom-forge": "Bond atoms together and repair the machine that builds the world's materials.",
  "element-hunter": "Race the clock to spot elements by atomic number, group, and valence electrons.",
  "build-the-atom": "Add protons, neutrons, and electrons to build the exact atom or isotope you're given."
};