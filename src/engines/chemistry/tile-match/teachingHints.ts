/**
 * engines/tile-match/teachingHints.ts
 *
 * Replaces the old hint behavior, which eliminated one wrong tile from
 * the board — exactly the "answer-revealing hint" pattern flagged as
 * wrong since the very first design philosophy document for this
 * platform. A hint should teach the underlying rule, not remove an
 * option for the player.
 *
 * RESTRUCTURED from a single flat string to HintContent
 * (concept/explanation/tip/illustration) to match the new HintModal's
 * real visual hierarchy (per the gameplay-redesign brief, section 7:
 * "Short explanation... Key concept... Practical tip" as distinct
 * parts, not one undifferentiated sentence in an inline card).
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
import type { HintContent } from "@/components/gameplay/HintModal";

const HINT_BY_CLUE_TYPE: Record<ClueType, HintContent> = {
  atomic_number: {
    concept: "Atomic Number",
    explanation: "The atomic number is the number of protons an element has — it's what actually defines which element it is.",
    tip: "Count along the periodic table starting from Hydrogen (1). Count by real element order, not by where a tile happens to sit on screen.",
    illustration: "⚛️"
  },
  electron_number: {
    concept: "Electron Number",
    explanation: "A neutral atom has the same number of electrons as protons — so its electron count is the same as its atomic number.",
    tip: "Look at the number on the tile, same as an Atomic Number clue — for a neutral atom, it's the exact same number either way.",
    illustration: "💫"
  },
  period: {
    concept: "Periods",
    explanation: "A period is a row on the periodic table. Elements in the same period have the same number of electron shells.",
    tip: "Period 1 is just H and He. Each new period starts a new row as atomic number increases.",
    illustration: "📊"
  },
  group: {
    concept: "Element Groups",
    explanation: "Elements in the same group share a column on the periodic table and behave similarly because they have the same number of valence electrons.",
    tip: "Check each tile's real chemical family, not just how it looks or what color it is.",
    illustration: "🧪"
  },
  valence: {
    concept: "Valence Electrons",
    explanation: "Valence electrons sit in the outermost shell of an atom, and they're what decide how an element bonds with others.",
    tip: "For main-group elements, the group number is a strong clue to how many valence electrons there are.",
    illustration: "⚡"
  },
  mass_number: {
    concept: "Mass Number",
    explanation: "The mass number is the total count of protons and neutrons in an atom's nucleus — it's roughly the element's atomic weight, rounded to a whole number.",
    tip: "Mass number is usually close to double the atomic number for lighter elements, but check the actual tile — don't just guess from atomic number alone.",
    illustration: "⚖️"
  }
};

/** Group-specific teaching detail — replaces the generic tip with a real,
 *  concrete fact about the clue's actual group when one is known. Only
 *  group-type clues have a real groupName to key off; atomic_number and
 *  valence clues keep their generic tip from HINT_BY_CLUE_TYPE above. */
const GROUP_TIPS: Record<ElementGroup, string> = {
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
 * Resolves the full HintContent for the CURRENT clue. For a group-type
 * clue, the tip becomes the real, specific fact about that group (e.g.
 * "Alkali metals sit in Group 1...") instead of the generic
 * "check each tile's real chemical family" line — for atomic_number and
 * valence clues, the generic tip is already concrete enough on its own.
 */
export function resolveTeachingHint(clue: Clue): HintContent {
  const base = HINT_BY_CLUE_TYPE[clue.type];
  if (clue.type === "group") {
    // clue.text IS the group name for group-type clues (see generateClue
    // in tileMatch.logic.ts) — safe to use directly as the GROUP_TIPS key.
    const groupTip = GROUP_TIPS[clue.text as ElementGroup];
    if (groupTip) return { ...base, tip: groupTip };
  }
  return base;
}