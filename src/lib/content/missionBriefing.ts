/**
 * lib/content/missionBriefing.ts
 *
 * Short narrative flavor line shown at the top of the Mission Briefing
 * (EntryScreen), per the product brief's example: "Welcome, Scientist. The
 * laboratory's element database has become disorganised..." — excitement,
 * not explanation. This is the one piece of mission-flow content that's
 * genuinely PER-GAME, not per-engine.
 *
 * NOTE: stepwise-solver games (Change of Subject, Simultaneous Equations)
 * skip the narration screen entirely — the engine hub acts as the welcome
 * and mode selector. These entries are kept here for reference only.
 */

const BRIEFING_BY_SLUG: Record<string, string> = {
  "atom-forge":
    "Welcome, Scientist. The laboratory's element database has become disorganised — bond the right atoms together before the system fails.",
  "build-the-atom":
    "Welcome, Scientist. A specimen has arrived with no label. Reconstruct it atom by atom to identify exactly what it is.",
  "element-hunter":
    "Welcome, Scientist. Elements have scattered across the lab shelves. Track down the right ones before the timer runs out.",
  "carbon-builder":
    "Welcome, Scientist. The lab needs working molecules, not loose atoms — bond them correctly, respecting every element's bonding limit, or the structure won't hold.",
  "matter-lab":
    "Welcome, Lab Technician. The temperature control system has failed — every sample is stuck in the wrong state. Take manual control of the heat, and tell Dr. Adaobi exactly what you observe happening to the particles.",
  "lost-worlds":
    "Welcome, Explorer. Ancient formulae have been discovered in the Lost Worlds — but their variables are buried under layers of mathematical obstacles. Help Nova excavate the hidden variables and restore knowledge to the Archive.",
  // Maths — stepwise-solver games (narration skipped, hub is the entry point)
  "change-of-subject-formula":
    "Welcome. You're about to rearrange formulae step by step. Ms. Chidera will guide you through every move.",
  "simultaneous-equations-detective":
    "Welcome. Solve systems of two equations step by step. Ms. Chidera walks you through the elimination method.",
};

const FALLBACK_BRIEFING = "Welcome back. Your next challenge is ready — complete it to earn XP and keep climbing.";

export function resolveMissionBriefing(gameSlug: string): string {
  return BRIEFING_BY_SLUG[gameSlug] ?? FALLBACK_BRIEFING;
}