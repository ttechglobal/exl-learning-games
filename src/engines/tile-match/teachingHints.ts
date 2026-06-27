/**
 * engines/tile-match/teachingHints.ts
 *
 * Replaces the old hint behavior, which eliminated one wrong tile from
 * the board — exactly the "answer-revealing hint" pattern flagged as
 * wrong since the very first design philosophy document for this
 * platform. A hint should teach the underlying rule, not remove an
 * option for the player.
 *
 * Keyed by ClueType (atomic_number / group / valence) since that's what
 * actually varies what the player needs to understand — not by element,
 * since the RULE behind "find Atomic Number 11" is the same rule behind
 * "find Atomic Number 17," only the specific number differs (and the
 * specific number is already shown in the clue text itself, so the hint
 * doesn't need to repeat it).
 */

import type { ClueType } from "@/engines/tile-match/tileMatch.config";
import type { ElementGroup } from "@/engines/tile-match/elementData";
import type { Clue } from "@/engines/tile-match/tileMatch.logic";

const HINT_BY_CLUE_TYPE: Record<ClueType, string> = {
  atomic_number: "Atomic number = the number of protons. Count along the periodic table starting from Hydrogen (1) — don't count by tile position, count by the real element order.",
  group: "Elements in the same group share a column on the periodic table and behave similarly — check each tile's real chemical family, not just how it looks.",
  valence: "Valence electrons sit in the outermost shell. For main-group elements, the group number is a strong clue to how many there are."
};

/** Group-specific teaching detail, used as a SECOND line alongside the
 *  generic valence/group explanation above when the clue's actual group
 *  is known — gives one more concrete, real fact without naming which
 *  tile is correct. Only group-type clues have a real groupName to key
 *  off; atomic_number and valence clues don't carry one. */
const GROUP_FACTS: Record<ElementGroup, string> = {
  "alkali metal": "Alkali metals sit in Group 1 — exactly one valence electron, and very reactive.",
  "alkaline earth metal": "Alkaline earth metals sit in Group 2 — two valence electrons.",
  "transition metal": "Transition metals sit in the central block — their valence electron count varies more than main-group elements.",
  metalloid: "Metalloids sit along the staircase between metals and nonmetals, sharing properties of both.",
  nonmetal: "Nonmetals are mostly found on the right side of the periodic table.",
  halogen: "Halogens sit in Group 17 — seven valence electrons, one short of a full shell.",
  "noble gas": "Noble gases sit in Group 18 — a full outer shell, which is why they rarely react.",
  metal: "Metals are mostly found on the left and center of the periodic table."
};

/**
 * Resolves the teaching text for the CURRENT clue. For a group-type
 * clue, appends the real fact about that specific group (e.g. "Alkali
 * metals sit in Group 1...") on top of the generic group-clue
 * explanation — for atomic_number/valence clues, just the generic line,
 * since there's no group name to attach a second fact to.
 */
export function resolveTeachingHint(clue: Clue): string {
  const base = HINT_BY_CLUE_TYPE[clue.type];
  if (clue.type === "group") {
    // clue.text IS the group name for group-type clues (see generateClue
    // in tileMatch.logic.ts) — safe to use directly as the GROUP_FACTS key.
    const groupFact = GROUP_FACTS[clue.text as ElementGroup];
    if (groupFact) return `${base} ${groupFact}`;
  }
  return base;
}