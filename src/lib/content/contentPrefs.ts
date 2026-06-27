/**
 * lib/content/conceptPrefs.ts
 *
 * "Skip if they already understand the topic" (product brief, Quick
 * Concepts section) — tracked per ENGINE TYPE, same reasoning as before:
 * a player who's already seen bond-match's concept cards on Atom Forge
 * shouldn't be forced through the identical cards again on a future
 * bond-match game.
 *
 * This replaces lib/content/howToPlayPrefs.ts (deleted, not kept) — that
 * file tracked whether the old HowToPlayScreen had been seen; this file
 * tracks the same kind of thing but for Quick Concepts, which is the
 * screen the product brief actually asks to support skip/revisit on.
 * Same localStorage approach and same reasoning for why it's appropriate
 * here (a UI preference, not player progress data — doesn't belong in
 * Supabase/AttemptResult) and same SSR-safety guards.
 */

const STORAGE_KEY_PREFIX = "exl:conceptsSeen:";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function hasSeenConcepts(engineType: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY_PREFIX + engineType) === "1";
  } catch {
    return false;
  }
}

export function markConceptsSeen(engineType: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_PREFIX + engineType, "1");
  } catch {
    // Same reasoning as before — not seeing the skip next time is a much
    // smaller problem than crashing the play flow over a preference write.
  }
}