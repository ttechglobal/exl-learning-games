/**
 * lib/content/localHighScores.ts
 *
 * "High Scores Before Accounts" — Universal Game Design Framework, Part
 * 11: "Accounts can come later. For now: when a player achieves a high
 * score, allow them to enter a display name. Save: Name, Score, Date,
 * Game. Display local leaderboards for each game." Exactly that, no
 * more — this is NOT a real leaderboard (no server, no other players'
 * scores visible across devices), it's a per-device local list, same
 * honest scope the brief itself describes ("once authentication is
 * introduced, these scores can be linked to user accounts automatically"
 * — i.e. this is explicitly meant to be replaced later, not a permanent
 * architecture).
 *
 * Same localStorage approach as ThemeProvider.tsx / conceptPrefs.ts
 * (third real usage of this pattern in the codebase) — same SSR-safety
 * guards, same "fail open rather than crash" reasoning.
 */

export interface HighScoreEntry {
  name: string;
  score: number;
  /** ISO date string, not a full timestamp — the brief asks for "Date," not time-of-day precision. */
  date: string;
}

const STORAGE_KEY_PREFIX = "exl:highScores:";
const MAX_ENTRIES_PER_GAME = 10;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function storageKey(gameSlug: string): string {
  return STORAGE_KEY_PREFIX + gameSlug;
}

export function getHighScores(gameSlug: string): HighScoreEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(gameSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    // Corrupt or inaccessible storage — an empty list is a much safer
    // fallback than crashing the Reflection screen over a leaderboard.
    return [];
  }
}

/**
 * True only when `score` would actually land in the saved top
 * MAX_ENTRIES_PER_GAME — used to decide whether to show the "Enter your
 * name" prompt at all. A low score on a game with fewer than
 * MAX_ENTRIES_PER_GAME entries still always qualifies (there's room),
 * matching what a player would intuitively expect from "is this a high
 * score."
 */
export function qualifiesAsHighScore(gameSlug: string, score: number): boolean {
  const existing = getHighScores(gameSlug);
  if (existing.length < MAX_ENTRIES_PER_GAME) return true;
  const lowestSaved = Math.min(...existing.map((e) => e.score));
  return score > lowestSaved;
}

/** Inserts a new entry, re-sorts descending by score, trims to
 *  MAX_ENTRIES_PER_GAME, and persists. Returns the updated list so the
 *  caller can render it immediately without a second read. */
export function saveHighScore(gameSlug: string, entry: HighScoreEntry): HighScoreEntry[] {
  const existing = getHighScores(gameSlug);
  const updated = [...existing, entry].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES_PER_GAME);

  if (isBrowser()) {
    try {
      window.localStorage.setItem(storageKey(gameSlug), JSON.stringify(updated));
    } catch {
      // Losing this one save is a much smaller problem than crashing
      // the Reflection screen over a storage write failure.
    }
  }

  return updated;
}