/**
 * lib/content/gameCardMeta.ts
 *
 * Re-exports from gameThemes.ts so all existing call sites continue
 * to work without changes. Do NOT add new entries here — edit
 * lib/content/gameThemes.ts instead.
 */
import { GAME_THEMES } from "@/lib/content/gameThemes";

export const GAME_CARD_ART: Record<string, string> = Object.fromEntries(
  Object.entries(GAME_THEMES)
    .filter(([, t]) => t.cardArt)
    .map(([slug, t]) => [slug, t.cardArt!])
);

export const GAME_CARD_DESC: Record<string, string> = Object.fromEntries(
  Object.entries(GAME_THEMES)
    .filter(([, t]) => t.description)
    .map(([slug, t]) => [slug, t.description])
);
