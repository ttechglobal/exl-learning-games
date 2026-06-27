/**
 * lib/content/difficultyModifiers.ts
 *
 * Player-chosen difficulty (Easy/Medium/Hard), per the product brief:
 * "Difficulty should become a player choice rather than a fixed label...
 * This makes every game replayable." This is the SAME mission played
 * differently, not a different mission — so a modifier is a small,
 * shallow set of overrides applied on top of whatever shared_config the
 * engine already resolves, not a parallel mission/content system.
 *
 * Genuinely engine-specific, because "harder" means something different
 * per mechanic:
 *   - bond-match / tile-match: both have a real sessionDurationSec already
 *     in their config schemas (see bondMatch.config.ts / tileMatch.config.ts)
 *     — Hard shortens it, Easy extends it. bond-match's `showBondTypeHint`
 *     is also a real toggle; Hard turns hints off.
 *   - particle-assembly has NO timer in its schema (untimed, checked on
 *     submit) — there's nothing honest to "speed up." Its real difficulty
 *     lever is feedbackRules verbosity: Easy gets every mismatch
 *     explained, Hard gets a single generic message, matching "mastery
 *     and speed" by removing hand-holding rather than inventing a fake
 *     timer this engine was never designed to have.
 *
 * Applied via applyDifficultyModifiers() below, which does a SHALLOW
 * merge onto the engine's resolved sharedConfig — only the specific keys
 * a tier actually changes, leaving everything else (element pools,
 * generators, mission lists) exactly as authored.
 */

export type PlayerDifficulty = "EASY" | "MEDIUM" | "HARD";

export const DIFFICULTY_INFO: Record<PlayerDifficulty, { label: string; emoji: string; description: string }> = {
  EASY: { label: "Easy", emoji: "\u{1F7E2}", description: "Perfect for learning and reinforcement." },
  MEDIUM: { label: "Medium", emoji: "\u{1F7E1}", description: "Balanced challenge." },
  HARD: { label: "Hard", emoji: "\u{1F534}", description: "Designed for mastery and speed." }
};

type ModifierSet = Record<PlayerDifficulty, Record<string, unknown>>;

const MODIFIERS_BY_ENGINE: Record<string, ModifierSet> = {
  "bond-match": {
    EASY: { showBondTypeHint: true, factory: { sessionDurationSec: 90 } },
    MEDIUM: { showBondTypeHint: true, factory: { sessionDurationSec: 60 } },
    HARD: { showBondTypeHint: false, factory: { sessionDurationSec: 40 } }
  },
  "tile-match": {
    EASY: { sessionDurationSec: 90, tileCount: 4 },
    MEDIUM: { sessionDurationSec: 60, tileCount: 6 },
    HARD: { sessionDurationSec: 40, tileCount: 9 }
  },
  "particle-assembly": {
    // No timer to adjust honestly (see file header) — Easy/Medium keep the
    // engine's full authored feedbackRules; Hard trims to a single,
    // generic rule so the game stops explaining exactly what's wrong.
    EASY: {},
    MEDIUM: {},
    HARD: { feedbackRules: [{ when: "any_mismatch", message: "That's not quite right yet." }] }
  }
};

/**
 * Shallow-merges a difficulty tier's overrides onto an already-resolved
 * sharedConfig. Only keys present in the modifier are touched; nested
 * objects (e.g. bond-match's `factory`) are merged one level deep, not
 * replaced wholesale, so e.g. `factory.orders` (untouched by any tier)
 * survives intact.
 */
export function applyDifficultyModifiers(
  engineType: string,
  sharedConfig: Record<string, unknown>,
  difficulty: PlayerDifficulty
): Record<string, unknown> {
  const modifiers = MODIFIERS_BY_ENGINE[engineType]?.[difficulty];
  if (!modifiers) return sharedConfig;

  const merged: Record<string, unknown> = { ...sharedConfig };
  for (const [key, value] of Object.entries(modifiers)) {
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