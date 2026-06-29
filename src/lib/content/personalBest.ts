/**
 * lib/content/personalBest.ts
 *
 * REPLACES lib/content/localHighScores.ts. Per direct decision: the
 * per-game competitive surfaces (HighScoreEntry's name-entry top-10,
 * InlineLeaderboardPreview, LeaderboardModal, getGameLeaderboard) are
 * retired — the weekly/monthly/all-time leaderboard (lib/db/queries/
 * leaderboard.ts's getWeeklyLeaderboard/getMonthlyLeaderboard) is now
 * the ONE competitive ranking surface in the app, and it's XP-based and
 * cross-game, not per-game-score-based. That's a real simplification:
 * the old per-game leaderboard only ever worked for engines that emit a
 * numeric finalScore (tile-match, bond-match's factory mode) — three of
 * four engines couldn't appear on it at all.
 *
 * What's kept, in a much smaller form: "did I beat my own best at THIS
 * game, on this device" is still a genuinely useful, different question
 * from "where do I rank against everyone" — a personal stat, not a
 * competitive one. No name entry (there's no list of names to enter a
 * name into anymore, just a single number), no top-10, no "Save"
 * button. Same localStorage approach as the file this replaces.
 */

const STORAGE_KEY_PREFIX = "exl:personalBest:";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function storageKey(gameSlug: string): string {
  return STORAGE_KEY_PREFIX + gameSlug;
}

/** This device's best-ever score on this game, or null if none recorded yet. */
export function getPersonalBest(gameSlug: string): number | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(gameSlug));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // Corrupt or inaccessible storage — null is a safe fallback, same
    // "fail open rather than crash" reasoning as the file this replaces.
    return null;
  }
}

/**
 * Records `score` as the new personal best if it beats (or there isn't
 * yet) a saved one. Returns { value, isNewBest } so the caller can show
 * "New personal best!" only when it's actually true, not just echo
 * whatever the stored value happens to be afterward.
 */
export function recordScore(gameSlug: string, score: number): { value: number; isNewBest: boolean } {
  const existing = getPersonalBest(gameSlug);
  const isNewBest = existing === null || score > existing;
  const value = isNewBest ? score : existing;

  if (isBrowser() && isNewBest) {
    try {
      window.localStorage.setItem(storageKey(gameSlug), String(value));
    } catch {
      // Losing this one save is a much smaller problem than crashing
      // the Reflection screen over a storage write failure.
    }
  }

  return { value, isNewBest };
}
