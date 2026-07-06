/**
 * lib/content/contentPrefs.ts
 *
 * Tracks whether a student has seen the Learn content for a given game.
 *
 * ARCHITECTURE CHANGE — Learn → Practice → Challenge → Master:
 *
 * Previously this tracked per ENGINE TYPE (e.g. "bond-match"), which
 * caused two bugs:
 *   1. Seeing Atom Forge's concepts would permanently skip them for
 *      Carbon Builder, which uses the same engine but different content.
 *   2. "Seen" persisted in sessionStorage, resetting on tab close but
 *      not on a genuinely new game session.
 *
 * Now tracks per GAME SLUG. The student sees Learn once per game —
 * not once per mission, not once per engine type. Stored in
 * localStorage (not sessionStorage) because "I've learned this game's
 * concepts" is persistent knowledge, not session state. A student who
 * played Nova last week shouldn't see Learn again today.
 *
 * The Learn content is ALWAYS accessible via the Learn tab on the
 * topic page and via "Review Concepts" in the game menu — the "seen"
 * flag only controls whether it's shown automatically on first entry.
 *
 * resetLearnSeen() is called when a student explicitly navigates to
 * the Learn tab, so they can always force a fresh viewing.
 */

const PREFIX = "exl:learnSeen:";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Has this student seen the Learn content for this game? */
export function hasSeenLearn(gameSlug: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(PREFIX + gameSlug) === "1";
  } catch {
    return false;
  }
}

/** Mark Learn as seen for this game — called when player finishes or skips Learn. */
export function markLearnSeen(gameSlug: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PREFIX + gameSlug, "1");
  } catch {}
}

/** Clear the seen flag — only used when player explicitly opens the Learn tab. */
export function resetLearnSeen(gameSlug: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(PREFIX + gameSlug);
  } catch {}
}

// ── Legacy shims — keep old functions working so nothing else breaks ─────────

const SESSION_PREFIX = "exl:conceptsSeen:";

export function hasSeenConcepts(engineType: string): boolean {
  if (!isBrowser()) return false;
  try {
    return window.sessionStorage.getItem(SESSION_PREFIX + engineType) === "1";
  } catch {
    return false;
  }
}

export function markConceptsSeen(engineType: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(SESSION_PREFIX + engineType, "1");
  } catch {}
}

export function resetConceptsSeen(engineType: string): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(SESSION_PREFIX + engineType);
  } catch {}
}
