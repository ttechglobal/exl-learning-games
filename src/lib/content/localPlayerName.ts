/**
 * lib/content/localPlayerName.ts
 *
 * Pure client-side, no backend, no account, no device cookie — exactly
 * the scope corrected to per direct feedback: high scores are LOCAL
 * (per device, via localHighScores.ts), and the one missing piece was
 * "the player shouldn't have to retype their name every single time."
 * This is that piece, and nothing more.
 *
 * Deliberately NOT the same thing as the server-side anonymous-identity
 * system built in an earlier round (lib/identity/deviceId.ts,
 * lib/db/queries/students.ts, the eg_device_id cookie) — that system
 * still exists in the codebase (not deleted; it's real, tested,
 * functioning infrastructure for a global/DB-backed leaderboard) but is
 * NOT what currently drives the name prompt or the high-score flow. Per
 * direct decision: focus on local per-game high scores working
 * correctly first: revisit wiring the two together (so a chosen local
 * name could also become the DB display_name) only once a real
 * account/cross-device system is actually being built — not now.
 *
 * Same "exl:" localStorage key prefix and SSR-safety pattern as every
 * other local-preference module in this codebase (ThemeProvider.tsx,
 * conceptPrefs.ts, localHighScores.ts) — kept consistent rather than
 * introducing a third naming convention.
 */

const STORAGE_KEY = "exl:playerName";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Returns the saved local player name, or null if one was never set
 *  (including: storage unavailable, or the player explicitly skipped
 *  the prompt — skipping does NOT save an empty string, it saves
 *  nothing, so a later high-score save still offers a real empty input
 *  rather than a confusing pre-filled blank). */
export function getLocalPlayerName(): string | null {
  if (!isBrowser()) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && stored.trim().length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/** Saves the local player name — called both from the one-time
 *  onboarding prompt AND from HighScoreEntry.tsx's save action (so a
 *  player who skips the prompt but later types a name into a
 *  high-score box still gets that name remembered for every game after
 *  that, not just the one they were playing when they first typed it). */
export function setLocalPlayerName(name: string): void {
  if (!isBrowser()) return;
  const trimmed = name.trim().slice(0, 20);
  if (trimmed.length === 0) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // Losing this preference is a much smaller problem than crashing —
    // same reasoning as every other localStorage write in this app.
  }
}

/** Tracks whether the one-time onboarding prompt has already been
 *  shown/dismissed on this browser — separate key from the name itself,
 *  since "the player explicitly skipped" and "the player has no saved
 *  name yet" need to be distinguishable (skipping should not show the
 *  prompt again on every visit). */
const ONBOARDED_KEY = "exl:playerNamePromptSeen";

export function hasSeenPlayerNamePrompt(): boolean {
  if (!isBrowser()) return true; // fail toward NOT nagging if storage is unavailable
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markPlayerNamePromptSeen(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // Same reasoning as above.
  }
}
