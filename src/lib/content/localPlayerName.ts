/**
 * lib/content/localPlayerName.ts
 *
 * Pure client-side, no backend, no account, no device cookie. Originally
 * built so a player wouldn't have to retype their name on every local
 * high-score save (lib/content/localHighScores.ts, since replaced by
 * lib/content/personalBest.ts — see that file's header for why the
 * name-entry high-score flow was retired). What's left is the genuinely
 * independent piece: the one-time onboarding name prompt
 * (PlayerNamePrompt.tsx / IdentityBootstrap.tsx) still needs somewhere
 * to read/write a locally-remembered display name, with no per-game
 * high-score flow involved at all anymore.
 *
 * Deliberately NOT the same thing as the server-side anonymous-identity
 * system built in an earlier round (lib/identity/deviceId.ts,
 * lib/db/queries/students.ts, the eg_device_id cookie) — that system
 * still exists in the codebase (not deleted; it's real, tested,
 * functioning infrastructure for the global/DB-backed leaderboard) but
 * is NOT what currently drives this local name prompt. Per direct
 * decision: revisit wiring the two together (so a chosen local name
 * could also become the DB display_name) only once a real
 * account/cross-device system is actually being built — not now.
 *
 * Same "exl:" localStorage key prefix and SSR-safety pattern as every
 * other local-preference module in this codebase (ThemeProvider.tsx,
 * conceptPrefs.ts, personalBest.ts) — kept consistent rather than
 * introducing a third naming convention.
 */

const STORAGE_KEY = "exl:playerName";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Returns the saved local player name, or null if one was never set
 *  (including: storage unavailable, or the player explicitly skipped
 *  the prompt — skipping does NOT save an empty string, it saves
 *  nothing, leaving a real empty/unset state rather than a confusing
 *  pre-filled blank). */
export function getLocalPlayerName(): string | null {
  if (!isBrowser()) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && stored.trim().length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/** Saves the local player name — called from the one-time onboarding
 *  prompt (PlayerNamePrompt.tsx / IdentityBootstrap.tsx), the only
 *  caller now that the per-game high-score name-entry flow is retired. */
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
