/**
 * lib/content/localPlayerName.ts
 *
 * Pure client-side, no backend, no account, no device cookie. Stores a
 * locally-remembered display name so the player doesn't retype it on
 * every high-score save.
 *
 * TRIGGER CHANGE: the one-time onboarding prompt is no longer shown on
 * first app open. It now fires after the player completes their FIRST
 * game — a much better moment. The player has experienced the product
 * and has a natural reason to care about their name (it's about to
 * appear on a leaderboard or personal best). See:
 *   - GameRuntime.tsx → calls requestPlayerNamePrompt() on first mission_completed
 *   - PlayerNamePrompt.tsx → watches for the flag, shows the modal
 *
 * Two separate localStorage keys, intentionally:
 *   exl:playerName        — the actual name string
 *   exl:playerNamePromptSeen — whether the prompt has been shown/dismissed
 *   exl:playerNamePromptRequested — set by GameRuntime to trigger the prompt
 */

const STORAGE_KEY = "exl:playerName";
const ONBOARDED_KEY = "exl:playerNamePromptSeen";
const TRIGGER_KEY = "exl:playerNamePromptRequested";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Returns the saved local player name, or null if one was never set. */
export function getLocalPlayerName(): string | null {
  if (!isBrowser()) return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && stored.trim().length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/** Saves the local player name. */
export function setLocalPlayerName(name: string): void {
  if (!isBrowser()) return;
  const trimmed = name.trim().slice(0, 20);
  if (trimmed.length === 0) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // Losing this preference is a smaller problem than crashing.
  }
}

/** Whether the one-time prompt has already been shown and dismissed. */
export function hasSeenPlayerNamePrompt(): boolean {
  if (!isBrowser()) return true;
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
    window.localStorage.removeItem(TRIGGER_KEY);
  } catch {
    // Same reasoning as above.
  }
}

/**
 * Called by GameRuntime after the player's FIRST completed mission.
 * Sets a flag that PlayerNamePrompt.tsx polls for, causing it to appear
 * on the Reflection screen without needing a full page re-render.
 * No-ops if the player has already seen and dismissed the prompt.
 */
export function requestPlayerNamePrompt(): void {
  if (!isBrowser()) return;
  if (hasSeenPlayerNamePrompt()) return;
  try {
    window.localStorage.setItem(TRIGGER_KEY, "1");
    // Fire a storage event so PlayerNamePrompt catches it immediately
    // even within the same tab (storage events normally only fire in
    // OTHER tabs; we dispatch a custom event for same-tab listening).
    window.dispatchEvent(new CustomEvent("exl:namePromptRequested"));
  } catch {
    // Non-critical.
  }
}

/** Checks whether the prompt has been requested but not yet shown. */
export function isPlayerNamePromptRequested(): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(TRIGGER_KEY) === "1";
  } catch {
    return false;
  }
}