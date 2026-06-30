/**
 * lib/content/conceptPrefs.ts
 *
 * "Skip if they already understand the topic" (product brief, Quick
 * Concepts section) — tracked per ENGINE TYPE, same reasoning as before:
 * a player who's already seen bond-match's concept cards on Atom Forge
 * shouldn't be forced through the identical cards again on a future
 * bond-match game.
 *
 * FIXED A CONFIRMED BUG: this used to persist in localStorage forever,
 * so the FIRST time a player ever saw Quick Concepts for an engine type
 * (e.g. picking Carbon Builder's first mission from the Track Map), it
 * silently disabled Quick Concepts for EVERY future mission of that
 * engine type too — including a brand new Track Map selection days
 * later. The intended behavior (per direct feedback) is: Quick Concepts
 * shows again whenever the player makes a fresh, deliberate mission
 * choice (Track Map / Level Select / Entry), and ONLY stays skipped for
 * the "Next Mission" auto-advance chain within that same sitting.
 *
 * Two changes fix this:
 *   1. sessionStorage instead of localStorage — "seen" now means "seen
 *      this browser tab session," not "seen ever." Closing the tab (or
 *      a new day, a new visit) naturally resets it.
 *   2. resetConceptsSeen(engineType), called by PlayClient.tsx the
 *      moment a mission is chosen via TrackMapScreen/LevelSelectScreen's
 *      onSelect (a genuinely fresh pick, not an auto-advance) — this is
 *      what makes Quick Concepts show again for a SECOND Track Map
 *      visit within the same sitting too, not just across tab sessions.
 *      The Next Mission auto-advance path (PlayClient's
 *      onAdvanceToNextMission, trackMap branch) deliberately does NOT
 *      call this, since markConceptsSeen already correctly applies
 *      there — that's the one case where staying skipped is the
 *      intended UX ("after completing a mission, the user should be
 *      able to start the next mission without going through pregame
 *      screens again").
 */

const STORAGE_KEY_PREFIX = "exl:conceptsSeen:";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function hasSeenConcepts(engineType: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY_PREFIX + engineType) === "1";
  } catch {
    return false;
  }
}

export function markConceptsSeen(engineType: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY_PREFIX + engineType, "1");
  } catch {
    // Same reasoning as before — not seeing the skip next time is a much
    // smaller problem than crashing the play flow over a preference write.
  }
}

/**
 * Clears the "seen" flag for this engine type — called on a fresh,
 * deliberate mission selection (Track Map / Level Select / Entry's
 * onSelect), NOT on the Next Mission auto-advance chain. See this
 * file's header for the full reasoning; this is the piece that makes
 * Quick Concepts show again on a genuinely new mission pick within the
 * same browser session, not just across sessions.
 */
export function resetConceptsSeen(engineType: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY_PREFIX + engineType);
  } catch {
    // Worst case Quick Concepts stays skipped one extra time — not worth crashing over.
  }
}