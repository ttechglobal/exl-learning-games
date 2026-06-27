/**
 * lib/content/missionBriefing.ts
 *
 * Short narrative flavor line shown at the top of the Mission Briefing
 * (EntryScreen), per the product brief's example: "Welcome, Scientist. The
 * laboratory's element database has become disorganised..." — excitement,
 * not explanation. This is the one piece of mission-flow content that's
 * genuinely PER-GAME, not per-engine: Atom Forge's "laboratory" framing
 * wouldn't make sense reused verbatim for a different chemistry game, the
 * way bond-match's controls legitimately are identical across missions.
 *
 * Falls back to a generic-but-still-narrative line for any game that
 * doesn't have custom copy yet, rather than showing nothing — every game
 * gets SOME briefing line, just not always a bespoke one.
 */

const BRIEFING_BY_SLUG: Record<string, string> = {
  "atom-forge":
    "Welcome, Scientist. The laboratory's element database has become disorganised — bond the right atoms together before the system fails.",
  "build-the-atom":
    "Welcome, Scientist. A specimen has arrived with no label. Reconstruct it atom by atom to identify exactly what it is.",
  "element-hunter":
    "Welcome, Scientist. Elements have scattered across the lab shelves. Track down the right ones before the timer runs out."
};

const FALLBACK_BRIEFING = "Welcome back. Your next challenge is ready — complete it to earn XP and keep climbing.";

export function resolveMissionBriefing(gameSlug: string): string {
  return BRIEFING_BY_SLUG[gameSlug] ?? FALLBACK_BRIEFING;
}