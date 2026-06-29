/**
 * lib/content/missionObjectives.ts
 *
 * Per-engine Mission Objectives — a short ✓ checklist shown for ~5 seconds
 * between the Mission Briefing and Quick Concepts. Replaces the old
 * lib/content/howToPlay.ts entirely (deleted, not kept alongside this) —
 * that file's dense objective/controls/scoring/hints/mistakes paragraphs
 * were a full "How to Play" page, which the product brief explicitly asks
 * to remove: "players should spend more time playing than reading."
 *
 * Still keyed by ENGINE TYPE, not per mission or per game, for the same
 * reason as before — Atom Forge's four levels all use the same bond-match
 * mechanic, so the objectives shouldn't be rewritten four times. The
 * engine-keyed lookup pattern is the one thing carried over from the old
 * file; the CONTENT is new and much shorter (a handful of short objective
 * lines, not six paragraph-shaped fields).
 *
 * A mission can still override/extend via payload.objectivesOverride for
 * the rare mission whose objectives genuinely differ from its engine's
 * default (e.g. a timed level adding "Finish before the timer expires").
 */

export interface MissionObjectives {
  /** Each string is one ✓ line — kept short on purpose, not a sentence with sub-clauses. */
  items: string[];
}

const OBJECTIVES_BY_ENGINE: Record<string, MissionObjectives> = {
  "bond-match": {
    items: [
      "Bond the correct pair of atoms together.",
      "Match each compound the mission asks for.",
      "Finish before time runs out."
    ]
  },
  "particle-assembly": {
    items: [
      "Add the correct number of protons, neutrons, and electrons.",
      "Match the exact target composition — partial builds don't score.",
      "Double-check before you lock in your answer."
    ]
  },
  "tile-match": {
    items: [
      "Find and match the correct pairs of tiles.",
      "Clear the whole board.",
      "Earn bonus XP for fewer wrong attempts."
    ]
  },
  "molecule-builder": {
    items: [
      "Drag atoms onto the build surface and bond them together.",
      "Respect every atom's maximum bond count — watch the counters.",
      "Hit Submit when your structure matches the target."
    ]
  }
};

const FALLBACK_OBJECTIVES: MissionObjectives = {
  items: ["Complete the mission's challenge.", "Earn XP for a successful finish."]
};

export function resolveMissionObjectives(engineType: string, missionPayload?: Record<string, unknown>): MissionObjectives {
  const base = OBJECTIVES_BY_ENGINE[engineType] ?? FALLBACK_OBJECTIVES;
  const override = missionPayload?.objectivesOverride as string[] | undefined;
  if (!override) return base;
  return { items: override };
}