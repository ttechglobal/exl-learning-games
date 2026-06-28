/**
 * lib/content/difficultyModifiers.ts
 *
 * Player-chosen difficulty (Easy/Medium/Hard). Per the Universal Game
 * Design Framework, Part 6: "Difficulty should affect gameplay rather
 * than simply increasing the timer."
 *
 * CORRECTION FROM AN EARLIER REVISION: bond-match's modifiers originally
 * only changed sessionDurationSec + a hint toggle — exactly the
 * timer-only pattern Part 6 warns against. Fixed here by making Easy/Hard
 * also change `elementPool` itself: Easy trims the dock to only the
 * elements actually needed for this mission's bonds (no distractors —
 * the player can't drag the wrong atom because there isn't one), Hard
 * adds the rest of the available roster as real distractors (more
 * options to sift through, real chance of a wrong drag). That's a genuine
 * gameplay change, not a faster clock with the same board.
 *
 * Two modifier shapes are supported, because bond-match's fix above
 * needs to READ the mission's existing elementPool to compute a derived
 * one — a static key/value overlay can't express "the same list, plus 2
 * more items not already in it":
 *   - static: a plain object of overrides (tile-match, particle-assembly)
 *   - function: (existingConfig) => partial overrides, for tiers that
 *     need to derive their value from what's already there (bond-match)
 *
 * Per engine, because "harder" means something mechanically different
 * each time:
 *   - bond-match: dock size/distractor count (see correction above) +
 *     sessionDurationSec + hint visibility, all three together
 *   - tile-match: tileCount (a real schema field controlling board size)
 *     + sessionDurationSec
 *   - particle-assembly: no honest timer (untimed, checked on submit) —
 *     its levers are feedbackRules verbosity AND hideTargetNumbers (added
 *     specifically for this, see particleAssembly.config.ts); Hard
 *     removes detailed mismatch explanations AND hides each counter's
 *     target number, so the player tracks/derives the right composition
 *     instead of watching it tick toward a number on screen
 *
 * Applied via applyDifficultyModifiers() below as a SHALLOW merge (one
 * level deep for nested objects) onto the engine's resolved config —
 * untouched keys (mission lists, generators, factory orders) survive
 * exactly as authored.
 */

export type PlayerDifficulty = "EASY" | "MEDIUM" | "HARD";

export const DIFFICULTY_INFO: Record<PlayerDifficulty, { label: string; emoji: string; description: string }> = {
  EASY: { label: "Easy", emoji: "\u{1F7E2}", description: "Perfect for learning and reinforcement." },
  MEDIUM: { label: "Medium", emoji: "\u{1F7E1}", description: "Balanced challenge." },
  HARD: { label: "Hard", emoji: "\u{1F534}", description: "Designed for mastery and speed." }
};

type StaticModifier = Record<string, unknown>;
type FunctionModifier = (existingConfig: Record<string, unknown>) => Record<string, unknown>;
type Modifier = StaticModifier | FunctionModifier;
type ModifierSet = Record<PlayerDifficulty, Modifier>;

/** Full available roster a bond-match game could draw distractors from.
 *  Mirrors engines/bond-match/bondData.ts's BOND_ELEMENTS keys — kept as
 *  a literal list rather than importing that module here, since this is
 *  content-layer code and importing an engine's internal data module
 *  would be a backwards dependency (engines shouldn't need to know about
 *  difficulty modifiers, and this file shouldn't need to import engine
 *  internals just to read a key list). If bondData.ts's roster changes,
 *  update this list to match. */
const BOND_MATCH_FULL_ROSTER = ["H", "O", "N", "Na", "Cl", "Mg", "K", "F"];

/** Easy: trim elementPool down to ONLY the elements this mission's pair(s)
 *  actually use — derived from `missions`/`factory.orders`' `pair` tuples,
 *  not hardcoded, so this works correctly for any mission's content
 *  without per-mission authoring. Falls back to the existing pool
 *  unchanged if no pair data is found (e.g. a future bond-match variant
 *  with a different shape) rather than guessing. */
function trimToRequiredElements(config: Record<string, unknown>): Record<string, unknown> {
  const pairs: unknown =
    (config.missions as { pair?: unknown }[] | undefined)?.map((m) => m.pair) ??
    (config.factory as { orders?: { pair?: unknown }[] } | undefined)?.orders?.map((o) => o.pair);
  if (!Array.isArray(pairs)) return {};

  const required = new Set<string>();
  for (const pair of pairs) {
    if (Array.isArray(pair)) {
      for (const symbol of pair) {
        if (typeof symbol === "string") required.add(symbol);
      }
    }
  }
  if (required.size === 0) return {};
  return { elementPool: Array.from(required) };
}

/** Hard: add distractor elements from the full roster that AREN'T already
 *  in this mission's pool, up to a small fixed number — real distractors
 *  the player could genuinely mis-drag, not just a bigger number with no
 *  gameplay consequence. */
function addDistractorElements(config: Record<string, unknown>): Record<string, unknown> {
  const existingPool = Array.isArray(config.elementPool) ? (config.elementPool as string[]) : [];
  const distractors = BOND_MATCH_FULL_ROSTER.filter((el) => !existingPool.includes(el)).slice(0, 2);
  if (distractors.length === 0) return {};
  return { elementPool: [...existingPool, ...distractors] };
}

/** Only returns a `factory` override key when the mission being modified
 *  ALREADY has a factory config — see the long comment on
 *  MODIFIERS_BY_ENGINE["bond-match"] above for the exact crash this
 *  fixes. A mission with no `factory` at all (Atom Forge Levels 1-3)
 *  gets `{}` here, so applyDifficultyModifiers's merge never touches
 *  `factory` for it — it simply stays absent, exactly as authored. */
function mergeFactoryOverrideIfPresent(config: Record<string, unknown>, sessionDurationSec: number): Record<string, unknown> {
  if (typeof config.factory !== "object" || config.factory === null) return {};
  return { factory: { sessionDurationSec } };
}

const MODIFIERS_BY_ENGINE: Record<string, ModifierSet> = {
  /**
   * BUG FIX: EASY and HARD used to unconditionally include a `factory`
   * key in their override object — `factory: { sessionDurationSec: 90 }`
   * etc — regardless of whether the mission being modified was a
   * factory mission at all. applyDifficultyModifiers's merge only does
   * a nested-object merge when the EXISTING value is also an object;
   * for a non-factory mission (Atom Forge Levels 1-3, which use
   * `missions`, not `factory`), config.factory doesn't exist yet, so
   * the merge fell through to a plain overwrite — `merged.factory`
   * became `{ sessionDurationSec: 90 }` with NO `orders` array, on a
   * mission that was never a factory mission to begin with.
   * BondMatchEngine.tsx's `isFactory = Boolean(shared.factory)` then
   * misread that as "this is a factory mission," and
   * `shared.factory!.orders[...]` crashed because `orders` was
   * undefined. This is exactly the
   * "Cannot read properties of undefined (reading 'length')" crash.
   *
   * Fixed by only emitting a `factory` override when the incoming
   * config ALREADY has one (mergeFactoryOverrideIfPresent) — Levels 1-3
   * now correctly get no `factory` key injected at any difficulty, and
   * Level 4 (the actual factory mission) still gets its session-length
   * tuned per tier exactly as before.
   */
  "bond-match": {
    EASY: (config) => ({
      ...trimToRequiredElements(config),
      showBondTypeHint: true,
      ...mergeFactoryOverrideIfPresent(config, 90)
    }),
    MEDIUM: (config) => ({ showBondTypeHint: true, ...mergeFactoryOverrideIfPresent(config, 60) }),
    HARD: (config) => ({
      ...addDistractorElements(config),
      showBondTypeHint: false,
      ...mergeFactoryOverrideIfPresent(config, 40)
    })
  },
  "tile-match": {
    EASY: { sessionDurationSec: 90, tileCount: 4 },
    MEDIUM: { sessionDurationSec: 60, tileCount: 6 },
    HARD: { sessionDurationSec: 40, tileCount: 9 }
  },
  "particle-assembly": {
    // No timer to adjust honestly (see file header) — Easy/Medium keep the
    // engine's full authored feedbackRules AND visible target numbers.
    // Hard does two things together: trims feedback verbosity AND hides
    // each counter's target number (hideTargetNumbers, see
    // particleAssembly.config.ts) so the player has to track or derive
    // the right composition themselves. BOTH feedback rule keys are
    // overridden on Hard, not just "any_mismatch" — buildFeedback() in
    // particleAssembly.logic.ts falls back to a verbose default template
    // for "proton_count_mismatch" specifically when no matching rule
    // exists, and that default template names the exact target proton
    // count in its text. Omitting only "any_mismatch" would have hidden
    // the number on the counter while still leaking it through the
    // failure message — overriding both rules closes that gap.
    EASY: {},
    MEDIUM: {},
    HARD: {
      feedbackRules: [
        { when: "proton_count_mismatch", message: "That's not the right number of protons yet." },
        { when: "any_mismatch", message: "That's not quite right yet." }
      ],
      hideTargetNumbers: true
    }
  }
};

/**
 * Shallow-merges a difficulty tier's overrides onto an already-resolved
 * config. Resolves a function modifier against the INCOMING config first
 * (so e.g. trimToRequiredElements sees the mission's real pair data),
 * then merges its result the same way a static modifier would be merged.
 * Only keys present in the modifier are touched; nested objects (e.g.
 * bond-match's `factory`) are merged one level deep, not replaced
 * wholesale, so e.g. `factory.orders` (untouched by any tier) survives
 * intact.
 */
export function applyDifficultyModifiers(
  engineType: string,
  config: Record<string, unknown>,
  difficulty: PlayerDifficulty
): Record<string, unknown> {
  const modifier = MODIFIERS_BY_ENGINE[engineType]?.[difficulty];
  if (!modifier) return config;

  const overrides = typeof modifier === "function" ? modifier(config) : modifier;

  const merged: Record<string, unknown> = { ...config };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = merged[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
      merged[key] = { ...(existing as Record<string, unknown>), ...(value as Record<string, unknown>) };
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

/** Whether this engine has any real difficulty modifiers defined at all —
 *  used to decide whether to show the difficulty-picker screen, since an
 *  engine with no modifiers shouldn't pretend the choice does anything. */
export function engineSupportsDifficultyChoice(engineType: string): boolean {
  return engineType in MODIFIERS_BY_ENGINE;
}