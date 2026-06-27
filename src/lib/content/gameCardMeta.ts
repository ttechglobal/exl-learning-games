/**
 * lib/content/gameCardMeta.ts
 *
 * Per-game card art + one-sentence description — extracted from
 * HomePage.tsx, where this lookup originally lived as a local, private
 * constant only the homepage's "Popular Games" section used. Promoted to
 * a shared module since /worlds also needs the exact same data (a
 * /worlds/[subject] split briefly existed and was reverted — both the
 * homepage and the single merged /worlds page need this regardless).
 *
 * CONTENT GAP, fixed previously: "build-the-atom" originally had neither
 * art nor a description here — added a real entry rather than leaving a
 * silently-broken card.
 *
 * ASSET VERIFICATION CAVEAT: no `public/` directory has ever been
 * included in any project upload to this session (only `src/` was
 * provided) — every path below (`/mascot/*.svg`, `/mascot/*.png`) is a
 * reference written on the assumption the file exists in YOUR actual
 * project, never something this session has been able to open and
 * confirm directly. If a card still looks broken after dropping these
 * files in, check the actual file at that exact path/case first before
 * assuming the code is wrong.
 */

export const GAME_CARD_ART: Record<string, string> = {
  "atom-forge": "/mascot/card-atom-forge.svg",
  /**
   * Once docs/ELEMENT_HUNTER_ENVIRONMENT_BRIEF.md's environment asset
   * exists at /mascot/scene-element-hunter.png, consider swapping this
   * card art to a cropped version of it (e.g. the left-shelf detail) so
   * the card and the in-game environment feel like the same place,
   * rather than two unrelated illustrations of the same game.
   */
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